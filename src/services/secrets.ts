import { deleteSecret, getSecret, setSecret } from './secureStorage';

const TOKEN_KEY = 'cartradar.bee.token';

export const getBeeToken = () => getSecret(TOKEN_KEY);
export const setBeeToken = (token: string) => setSecret(TOKEN_KEY, token.trim());
export const clearBeeToken = () => deleteSecret(TOKEN_KEY);
