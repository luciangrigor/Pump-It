import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Account, Avatars, Client, Databases, ID, OAuthProvider, Query } from 'react-native-appwrite';

export const config = {
  platform:     'com.grigor.pumpit',
  endpoint:     process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!,
  projectId:    process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!,
  databaseId:   process.env.EXPO_PUBLIC_APPWRITE_DATABASE!,
  collectionId: process.env.EXPO_PUBLIC_APPWRITE_COLLECTION!,
};

const client = new Client()
  .setEndpoint(config.endpoint)
  .setProject(config.projectId)
  .setPlatform(config.platform);

export const avatar    = new Avatars(client);
export const account   = new Account(client);
export const databases = new Databases(client);

export type SessionDoc = {
  userId:    string;
  startTime: string;
  endTime:   string;
  avgHr:     number;
  minHr:     number;
  maxHr:     number;
  avgOxy:    number;
  anomalies: number;
};

export async function saveSession(doc: SessionDoc): Promise<void> {
  await databases.createDocument(
    config.databaseId,
    config.collectionId,
    ID.unique(),
    doc,
  );
}

export async function loadSessions(userId: string): Promise<SessionDoc[]> {
  const res = await databases.listDocuments(
    config.databaseId,
    config.collectionId,
    [Query.equal('userId', userId), Query.orderDesc('startTime'), Query.limit(100)],
  );
  return res.documents as unknown as SessionDoc[];
}

export async function login() {
  try {
    try { await account.deleteSessions(); } catch {}

    const redirectUri = `appwrite-callback-${config.projectId}://`;
    const response    = account.createOAuth2Token({
      provider: OAuthProvider.Google,
      success:  redirectUri,
      failure:  redirectUri,
    });
    if (!response) throw new Error('No response');

    const browser = await WebBrowser.openAuthSessionAsync(response.toString(), redirectUri);
    if (browser.type !== 'success') throw new Error('Browser closed');

    const params = Linking.parse(browser.url).queryParams ?? {};
    const secret = params.secret?.toString();
    const userId = params.userId?.toString();
    if (!secret || !userId) throw new Error('Missing params');

    const session = await account.createSession({ userId, secret });
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
    return { ...res, avatar: avatar.getInitialsURL(res.name).toString() };
  } catch {
    return null;
  }
}
