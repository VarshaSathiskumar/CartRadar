import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'cartradar.bee.token';

export const getBeeToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setBeeToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token.trim());
export const clearBeeToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
