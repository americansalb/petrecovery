/**
 * NextAuth configuration.
 *
 * - Credentials (email/password) — verified against User.passwordHash.
 * - OAuth (Google / Facebook / Apple) — persistence handled by the
 *   @auth/prisma-adapter; we override `createUser` to route through our
 *   own userService so OAuth-created users follow the same shape and audit
 *   log as every other creation path.
 * - Sessions are JWT (no DB session rows). The Session model in schema.prisma
 *   exists only to satisfy the adapter's typings.
 */

import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import AppleProvider from 'next-auth/providers/apple';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { createUser } from './userService';

/**
 * The PrismaAdapter speaks NextAuth's User shape ({ name, email, image,
 * emailVerified }), but our User model requires `firstName`. We wrap
 * `createUser` so adapter-driven creation funnels through userService and
 * derives firstName/lastName from the OAuth display name.
 */
function buildAdapter() {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    async createUser(data) {
      const nameParts = (data.name || '').trim().split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] || data.email?.split('@')[0] || 'User';
      const lastName = nameParts.slice(1).join(' ') || null;

      const { user } = await createUser({
        source: 'oauth',
        email: data.email,
        firstName,
        lastName,
        profileImage: data.image,
      });
      return user;
    },
  };
}

export const authOptions = {
  adapter: buildAdapter(),

  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) return null;

        // Phase 3 will surface this to the UI properly. For now NextAuth
        // forwards the message via ?error= on the login page.
        if (!user.emailVerified) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.firstName,
          firstName: user.firstName,
          lastName: user.lastName,
          image: user.profileImage,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),

    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
              },
            },
          }),
        ]
      : []),

    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),

    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
          }),
        ]
      : []),
  ],

  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
    newUser: '/onboarding',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // First sign-in: copy fields from the user object returned by
      // authorize() (credentials) or the adapter (OAuth).
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.emailVerified = user.emailVerified;
      }

      // For adapter-created OAuth users, the user object only has fields
      // NextAuth knows about (id/name/email/image). Hydrate the rest from DB.
      if (token.id && token.role === undefined) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: {
            role: true,
            firstName: true,
            lastName: true,
            emailVerified: true,
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.firstName = dbUser.firstName;
          token.lastName = dbUser.lastName;
          token.emailVerified = dbUser.emailVerified;
        }
      }

      // session.update() from the client can patch a small set of fields.
      if (trigger === 'update' && session) {
        if (session.firstName) token.firstName = session.firstName;
        if (session.lastName) token.lastName = session.lastName;
        if (session.role) token.role = session.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.firstName = token.firstName;
        session.user.lastName = token.lastName;
        session.user.emailVerified = token.emailVerified;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },

  events: {
    async signIn({ user, account, isNewUser }) {
      if (!user?.id) return;
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      } catch (error) {
        console.error('Failed to update lastLoginAt:', error);
      }
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

export const getSession = () => getServerSession(authOptions);

export function getAvailableProviders() {
  const providers = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({ id: 'google', name: 'Google', icon: 'google' });
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push({ id: 'facebook', name: 'Facebook', icon: 'facebook' });
  }
  if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
    providers.push({ id: 'apple', name: 'Apple', icon: 'apple' });
  }
  return providers;
}
