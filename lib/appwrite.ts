import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
    Account,
    Avatars,
    Client,
    OAuthProvider,
} from "react-native-appwrite";

export const config = {
    platform: 'com.grigor.pumpit',
    endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
    projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
}

export const client = new Client();

client
    .setEndpoint(config.endpoint!)
    .setProject(config.projectId!)
    .setPlatform(config.platform!)

export const avatar = new Avatars(client);
export const account = new Account(client);

export async function login() {
    try {
        // Clear any existing session first
        try { await account.deleteSessions(); } catch { }

        const redirectUri = Linking.createURL('/');

        const response = await account.createOAuth2Token(
            OAuthProvider.Google, 
            redirectUri
        );

        if (!response) throw new Error('Failed to login');

        const browserResult = await WebBrowser.openAuthSessionAsync(
            response.toString(),
            redirectUri
        );

        if (browserResult.type != 'success') throw new Error ('Failed to login');

        const parsed = Linking.parse(browserResult.url);

        const secret = parsed.queryParams?.secret?.toString();
        const userId = parsed.queryParams?.userId?.toString();

        if (!secret || !userId) throw new Error('Failed to login');

        const session = await account.createSession(userId, secret);

        if (!session) throw new Error('Failed to create a session');

        return true;

    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function logout(){
    try {
        await account.deleteSession('current');
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

export async function getUser() {
    try {
        const response = await account.get();

        if (response.$id){
            const userAvatar = avatar.getInitials(response.name);
            return {
                ... response,
                avatar: userAvatar.toString(),
            }
        }
        
    } catch (error) {
        console.error(error);
        return null;
    }
}