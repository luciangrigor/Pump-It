import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Account, Avatars, Client, OAuthProvider } from 'react-native-appwrite';

export const config = {
  platform:  'com.grigor.pumpit',
  endpoint:  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
};

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setPlatform(config.platform);

export const avatar  = new Avatars(client);
export const account = new Account(client);

export async function login() {
  try {
    // clear session
    try { await account.deleteSessions(); } catch {}

    const redirectUri = Linking.createURL('/');
    const response    = await account.createOAuth2Token(OAuthProvider.Google, redirectUri);
    if (!response) throw new Error('No response');

    const browser = await WebBrowser.openAuthSessionAsync(response.toString(), redirectUri);
    if (browser.type !== 'success') throw new Error('Browser closed');

    const params = Linking.parse(browser.url).queryParams ?? {};
    const secret = params.secret?.toString();
    const userId = params.userId?.toString();
    if (!secret || !userId) throw new Error('Missing params');

    const session = await account.createSession(userId, secret);
    if (!session) throw new Error('No session');

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function logout() {
  try {
    await account.deleteSessions();
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function getUser() {
  try {
    const res = await account.get();
    if (!res.$id) return null;
    return { ...res, avatar: avatar.getInitials(res.name).toString() };
  } catch (error) {
    console.error(error);
    return null;
  }
}
