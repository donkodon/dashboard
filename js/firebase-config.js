// Firebase設定ファイル

// Firebase SDKの読み込みチェック
if (typeof firebase === 'undefined') {
    console.warn('Firebase SDKが読み込まれていません。Firebase機能は利用できません。');
}

// Firebase設定
const firebaseConfig = {
    apiKey: "AIzaSyDexampleexampleexampleexampleexample",
    authDomain: "sasage-7568e.firebaseapp.com",
    databaseURL: "https://sasage-7568e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sasage-7568e",
    storageBucket: "sasage-7568e.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:exampleexampleexampleexample"
};

// Firebaseの初期化（Firebaseが利用可能な場合のみ）
let firebaseApp = null;
let database = null;
let storage = null;

if (typeof firebase !== 'undefined') {
    try {
        firebaseApp = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        storage = firebase.storage();
        console.log('Firebaseが正常に初期化されました');
    } catch (error) {
        console.error('Firebaseの初期化に失敗しました:', error);
    }
}

// Firebase連携クラス
class FirebaseService {
    constructor() {
        this.app = firebaseApp;
        this.database = database;
        this.storage = storage;
        this.isConnected = !!firebaseApp;
    }

    // Firebase接続状態の確認
    checkConnection() {
        return this.isConnected;
    }

    // データをFirebaseに送信
    async sendData(path, data) {
        if (!this.isConnected) {
            throw new Error('Firebaseに接続していません');
        }

        try {
            const ref = this.database.ref(path);
            const snapshot = await ref.push(data);
            return snapshot.key;
        } catch (error) {
            console.error('Firebaseデータ送信エラー:', error);
            throw error;
        }
    }

    // Firebaseからデータを取得
    async getData(path) {
        if (!this.isConnected) {
            throw new Error('Firebaseに接続していません');
        }

        try {
            const ref = this.database.ref(path);
            const snapshot = await ref.once('value');
            return snapshot.val();
        } catch (error) {
            console.error('Firebaseデータ取得エラー:', error);
            throw error;
        }
    }

    // ファイルをFirebase Storageにアップロード
    async uploadFile(file, path) {
        if (!this.isConnected) {
            throw new Error('Firebaseに接続していません');
        }

        try {
            const storageRef = this.storage.ref(path);
            const uploadTask = storageRef.put(file);
            
            // アップロード進捗の監視
            uploadTask.on('state_changed', 
                (snapshot) => {
                    // 進捗の処理（必要に応じて）
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log('アップロード進捗:', progress);
                }, 
                (error) => {
                    // エラー処理
                    console.error('アップロードエラー:', error);
                    throw error;
                }, 
                async () => {
                    // アップロード完了後の処理
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        console.log('ファイルがアップロードされました。ダウンロードURL:', downloadURL);
                        return downloadURL;
                    } catch (error) {
                        console.error('ダウンロードURL取得エラー:', error);
                        throw error;
                    }
                }
            );
            
            // 最終的な結果を返す
            const snapshot = await uploadTask;
            const downloadURL = await snapshot.ref.getDownloadURL();
            return downloadURL;
        } catch (error) {
            console.error('ファイルアップロードエラー:', error);
            throw error;
        }
    }

    // Firebase Storageからファイルを取得
    async getFileDownloadURL(path) {
        if (!this.isConnected) {
            throw new Error('Firebaseに接続していません');
        }

        try {
            const storageRef = this.storage.ref(path);
            const url = await storageRef.getDownloadURL();
            return url;
        } catch (error) {
            console.error('ファイルURL取得エラー:', error);
            throw error;
        }
    }
}

// グローバルインスタンスの作成
const firebaseService = new FirebaseService();