import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = { apiKey: 'AIzaSyARtnB8VVTVAANkGAQGV2gFowFSCstWzyk', authDomain: 'paisapath-private-2026.firebaseapp.com', projectId: 'paisapath-private-2026', storageBucket: 'paisapath-private-2026.firebasestorage.app', messagingSenderId: '501846342252', appId: '1:501846342252:web:f5f29f02835cb34761b649' };
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
