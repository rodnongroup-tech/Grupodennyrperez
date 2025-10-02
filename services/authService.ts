
import { APP_USERS } from '../constants';
import { AppUser } from '../types';

const SESSION_KEY = 'gdp_currentUser';

// This service simulates calls to an authentication backend.
export const authService = {
  login: async (username: string, password: string): Promise<AppUser | null> => {
    // Simulate network delay
    await new Promise(res => setTimeout(res, 500)); 

    const user = APP_USERS.find(u => u.username.toUpperCase() === username.toUpperCase());
    
    if (user && user.password === password) {
      // In a real app, you'd get a token from the backend and save it.
      // Here, we save the user object to sessionStorage to simulate a logged-in session.
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
        return user;
      } catch (e) {
        console.error("Could not save user session to sessionStorage", e);
        return null; // Return null if session can't be saved
      }
    }
    
    return null; // Login failed
  },
  
  logout: (): void => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch(e) {
      console.error("Could not remove user session from sessionStorage", e);
    }
  },

  getCurrentUser: (): AppUser | null => {
    try {
      const userStr = sessionStorage.getItem(SESSION_KEY);
      if (userStr) {
        return JSON.parse(userStr) as AppUser;
      }
    } catch (e) {
      console.error("Could not parse user session from sessionStorage", e);
      // If parsing fails, clear the corrupt key
      sessionStorage.removeItem(SESSION_KEY);
    }
    return null;
  }
};
