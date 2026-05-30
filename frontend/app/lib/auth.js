/**
 * Phase 7: Enhanced Authentication with Social Login
 *
 * NextAuth.js configuration with:
 * - Credentials provider (email/password)
 * - Google OAuth
 * - Facebook OAuth
 * - Apple OAuth
 * - Account linking
 */

import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import AppleProvider from 'next-auth/providers/apple';
import prisma from './prisma';
import bcrypt from 'bcryptjs';

/**
 * @type {import('next-auth').AuthOptions}
 * Typed so `session.strategy: 'jwt'` is the literal SessionStrategy (not widened
 * to `string`) — otherwise the 12 .ts routes calling getServerSession(authOptions)
 * fail `next build`'s type check and block the merge.
 */
export const authOptions = {
  providers: [
    // Email/Password credentials
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Look up user in database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        // SEC-18 mitigation (defense-in-depth): the originally-seeded
        // contact@aalb.org admin password is in git history. Block this account
        // at the auth layer — regardless of password — until the live DB hash is
        // rotated. Block-by-default (protects even with zero config); clear by
        // setting SEC18_ROTATED=true AFTER rotating the live password. Tradeoff:
        // the legit admin stays locked until that env is set — the correct safe
        // default (briefly lock the owner out > leave a known backdoor open).
        // Owner DB-rotation remains the real fix; this only covers one known email.
        if (user.email === 'contact@aalb.org' && process.env.SEC18_ROTATED !== 'true') {
          return null;
        }

        // Verify password
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        // Block login for unverified emails. Return null (same as a bad
        // password) rather than a distinct error: throwing EMAIL_NOT_VERIFIED
        // leaked a registration oracle on the raw /api/auth/callback/credentials
        // response (registered+unverified vs unknown email were distinguishable).
        // The login UI already shows a generic message, so this is no UX change;
        // guiding unverified users to re-verify belongs on a separate,
        // rate-limited resend path (follow-up), not the login error.
        if (!user.emailVerified) {
          return null;
        }

        // Return user object
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

    // Google OAuth
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

    // Facebook OAuth
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET
      ? [
          FacebookProvider({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          }),
        ]
      : []),

    // Apple OAuth
    ...(process.env.APPLE_ID && process.env.APPLE_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_ID,
            clientSecret: process.env.APPLE_SECRET,
          }),
        ]
      : []),
  ],

  // Adapter for database persistence (account linking)
  // Using custom callbacks instead of adapter for more control

  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
    newUser: '/onboarding',
  },

  session: {
    // Cast the literal so authOptions' inferred type satisfies NextAuth's
    // SessionStrategy ('jwt'|'database'). In a .js file 'jwt' infers as `string`,
    // which made getServerSession(authOptions) fail `next build` type-check in
    // the 12 .ts routes that import it (dev/jest don't type-check; build does).
    strategy: /** @type {import('next-auth').SessionStrategy} */ ('jwt'),
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    /**
     * Sign-in callback - handle OAuth account creation/linking
     */
    async signIn({ user, account, profile }) {
      // Credentials login - already handled by authorize
      if (account?.provider === 'credentials') {
        return true;
      }

      // OAuth login
      if (account && profile) {
        try {
          const email = user.email?.toLowerCase();

          if (!email) {
            console.error('OAuth sign-in without email');
            return false;
          }

          // Check if user exists
          let existingUser = await prisma.user.findUnique({
            where: { email },
            include: { accounts: true },
          });

          if (existingUser) {
            // Check if this OAuth account is already linked
            const existingAccount = existingUser.accounts?.find(
              (acc) => acc.provider === account.provider && acc.providerAccountId === account.providerAccountId
            );

            if (!existingAccount) {
              // Link new OAuth account to existing user
              await prisma.account.create({
                data: {
                  userId: existingUser.id,
                  type: account.type,
                  provider: account.provider,
                  providerAccountId: account.providerAccountId,
                  access_token: account.access_token,
                  refresh_token: account.refresh_token,
                  expires_at: account.expires_at,
                  token_type: account.token_type,
                  scope: account.scope,
                  id_token: account.id_token,
                },
              });
            }

            // Update user: set emailVerified (OAuth proves email ownership) and profile image if not set
            const updateData = {};
            if (!existingUser.emailVerified) {
              updateData.emailVerified = new Date();
            }
            if (!existingUser.profileImage && user.image) {
              updateData.profileImage = user.image;
            }
            if (Object.keys(updateData).length > 0) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: updateData,
              });
            }
          } else {
            // Create new user from OAuth
            const names = user.name?.split(' ') || [''];
            const firstName = names[0] || profile.given_name || 'User';
            const lastName = names.slice(1).join(' ') || profile.family_name || '';

            existingUser = await prisma.user.create({
              data: {
                email,
                firstName,
                lastName,
                profileImage: user.image,
                emailVerified: new Date(), // OAuth emails are verified
                role: 'USER',
                accounts: {
                  create: {
                    type: account.type,
                    provider: account.provider,
                    providerAccountId: account.providerAccountId,
                    access_token: account.access_token,
                    refresh_token: account.refresh_token,
                    expires_at: account.expires_at,
                    token_type: account.token_type,
                    scope: account.scope,
                    id_token: account.id_token,
                  },
                },
              },
            });
          }

          // Attach user ID to the user object for JWT callback
          user.id = existingUser.id;
          user.role = existingUser.role;

          return true;
        } catch (error) {
          console.error('OAuth sign-in error:', error);
          return false;
        }
      }

      return true;
    },

    /**
     * JWT callback - add custom claims to token
     */
    async jwt({ token, user, account, trigger, session }) {
      // Initial sign-in
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.emailVerified = user.emailVerified;
      }

      // OAuth sign-in - ensure user ID is set
      if (account && !token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email?.toLowerCase() },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.firstName = dbUser.firstName;
          token.lastName = dbUser.lastName;
        }
      }

      // Update session
      if (trigger === 'update' && session) {
        if (session.firstName) token.firstName = session.firstName;
        if (session.lastName) token.lastName = session.lastName;
        if (session.role) token.role = session.role;
      }

      return token;
    },

    /**
     * Session callback - expose custom claims to client
     */
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

    /**
     * Redirect callback - handle post-auth redirects
     */
    async redirect({ url, baseUrl }) {
      // Handle relative URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      // Handle same-origin URLs
      if (new URL(url).origin === baseUrl) {
        return url;
      }

      // Default to base URL
      return baseUrl;
    },
  },

  events: {
    /**
     * Sign-in event - log successful logins
     */
    async signIn({ user, account, isNewUser }) {
      console.log(`User signed in: ${user.email} via ${account?.provider || 'credentials'} (new: ${isNewUser})`);

      // Update last login time
      if (user.id) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (error) {
          console.error('Failed to update last login:', error);
        }
      }
    },

    /**
     * Create user event - handle new user creation
     */
    async createUser({ user }) {
      console.log(`New user created: ${user.email}`);
    },

    /**
     * Link account event - handle account linking
     */
    async linkAccount({ user, account }) {
      console.log(`Account linked: ${user.email} -> ${account.provider}`);
    },
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === 'development',
};

export const getSession = () => getServerSession(authOptions);

/**
 * Get available OAuth providers
 */
export function getAvailableProviders() {
  const providers = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({
      id: 'google',
      name: 'Google',
      icon: 'google',
    });
  }

  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push({
      id: 'facebook',
      name: 'Facebook',
      icon: 'facebook',
    });
  }

  if (process.env.APPLE_ID && process.env.APPLE_SECRET) {
    providers.push({
      id: 'apple',
      name: 'Apple',
      icon: 'apple',
    });
  }

  return providers;
}
