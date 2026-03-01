import { NextAuthOptions, getServerSession } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import sql from '@/db/schema';
import { seedDatabase } from '@/db/seed';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      try {
        await seedDatabase();
      } catch (e) {
        console.error('[NextAuth] seedDatabase error:', e);
      }
      try {
        await sql`
          INSERT INTO users (id, email, name, image) VALUES (${user.id}, ${user.email}, ${user.name ?? null}, ${user.image ?? null})
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, image = EXCLUDED.image
        `;
      } catch (e) {
        console.error('[NextAuth] user upsert error:', e);
        // Still allow sign in even if DB write fails
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
  pages: { signIn: '/' },
  secret: process.env.NEXTAUTH_SECRET,
};

export function getAuth() {
  return getServerSession(authOptions);
}
