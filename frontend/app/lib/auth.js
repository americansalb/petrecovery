import { getServerSession } from 'next-auth/next';
import CredentialsProvider from 'next-auth/providers/credentials';
// import prisma from './prisma';
// import bcrypt from 'bcryptjs';

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // TODO: Replace with actual database lookup when Prisma is set up
        // const user = await prisma.user.findUnique({
        //   where: { email: credentials.email }
        // });
        //
        // if (!user || !user.passwordHash) {
        //   return null;
        // }
        //
        // const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        // if (!isValid) {
        //   return null;
        // }
        //
        // return {
        //   id: user.id,
        //   email: user.email,
        //   name: user.firstName,
        // };

        // Temporary mock authentication for development
        if (credentials.email && credentials.password === 'demo') {
          return {
            id: 'demo-user-123',
            email: credentials.email,
            name: credentials.email.split('@')[0],
          };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: '/login',
    signOut: '/',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export const getSession = () => getServerSession(authOptions);
