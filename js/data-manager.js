// データ管理クラス

class DataManager {
    constructor() {
        this.data = {
            measurements: [],
            photos: [],
            assignees: [],
            categories: []
        };
    }

    // データの初期化
    async initialize() {
        try {
            console.log('データマネージャー初期化開始');
            
            // メタデータを読み込み
            const metadataStr = localStorage.getItem('sasageData_metadata');
            if (metadataStr) {
                const metadata = JSON.parse(metadataStr);
                console.log('メタデータ:', metadata);
                
                // チャンクデータを読み込み
                const measurements = [];
                const photos = [];
                
                // 採寸データをチャンクから読み込み
                const measurementsChunks = Math.ceil(metadata.measurementsCount / metadata.chunkSize);
                for (let i = 0; i < measurementsChunks; i++) {
                    const chunkKey = `sasageData_measurements_${i}`;
                    const chunkStr = localStorage.getItem(chunkKey);
                    if (chunkStr) {
                        try {
                            const chunk = JSON.parse(chunkStr);
                            measurements.push(...chunk);
                        } catch (error) {
                            console.error(`チャンクデータの読み込みに失敗しました (${chunkKey}):`, error);
                            // チャンクデータが破損している場合はスキップ
                            continue;
                        }
                    }
                }
                
                // 撮影データをチャンクから読み込み
                const photosChunks = Math.ceil(metadata.photosCount / metadata.chunkSize);
                for (let i = 0; i < photosChunks; i++) {
                    const chunkKey = `sasageData_photos_${i}`;
                    const chunkStr = localStorage.getItem(chunkKey);
                    if (chunkStr) {
                        try {
                            const chunk = JSON.parse(chunkStr);
                            photos.push(...chunk);
                        } catch (error) {
                            console.error(`チャンクデータの読み込みに失敗しました (${chunkKey}):`, error);
                            // チャンクデータが破損している場合はスキップ
                            continue;
                        }
                    }
                }
                
                this.data = {
                    measurements: measurements,
                    photos: photos,
                    assignees: Array.isArray(metadata.assignees) ? metadata.assignees : [],
                    categories: Array.isArray(metadata.categories) ? metadata.categories : []
                };
                
                // 文字化けデータのクリーニング
                this.data.measurements = this.cleanCorruptedData(this.data.measurements);
                this.data.photos = this.cleanCorruptedData(this.data.photos);
                
                console.log('データ構造検証OK:', this.data);
            } else {
                // メタデータがない場合は古いデータ形式をチェック
                const savedData = localStorage.getItem('sasageData');
                if (savedData) {
                    try {
                        const parsedData = JSON.parse(savedData);
                        console.log('パース後のデータ:', parsedData);
                        // データ構造の検証
                        if (parsedData && typeof parsedData === 'object') {
                            this.data = {
                                measurements: Array.isArray(parsedData.measurements) ? parsedData.measurements : [],
                                photos: Array.isArray(parsedData.photos) ? parsedData.photos : [],
                                assignees: Array.isArray(parsedData.assignees) ? parsedData.assignees : [],
                                categories: Array.isArray(parsedData.categories) ? parsedData.categories : []
                            };
                            
                            // 文字化けデータのクリーニング
                            this.data.measurements = this.cleanCorruptedData(this.data.measurements);
                            this.data.photos = this.cleanCorruptedData(this.data.photos);
                            
                            console.log('データ構造検証OK:', this.data);
                            // 新しい形式に変換
                            this.saveData();
                        } else {
                            // 不正なデータの場合、初期データを設定
                            console.log('不正なデータ形式、初期データを設定');
                            this.data = this.getDefaultData();
                            this.saveData();
                        }
                    } catch (error) {
                        console.error('古いデータ形式の読み込みに失敗しました:', error);
                        // エラー時も初期データを設定
                        this.data = this.getDefaultData();
                        this.saveData();
                    }
                } else {
                    // 初期データの設定
                    console.log('ローカルストレージにデータがありません、初期データを設定');
                    this.data = this.getDefaultData();
                    this.saveData();
                }
            }
            
            console.log('データマネージャー初期化完了:', this.data);
            return true;
        } catch (error) {
            console.error('データの初期化に失敗しました:', error);
            // エラー時も初期データを設定
            this.data = this.getDefaultData();
            return false;
        }
    }

    // デフォルトデータの取得
    getDefaultData() {
        return {
            measurements: [
                { id: 1, date: '2023-01-15', assignee: '田中', category: 'トップス', count: 45 },
                { id: 2, date: '2023-01-16', assignee: '佐藤', category: 'ボトムス', count: 32 },
                { id: 3, date: '2023-01-17', assignee: '鈴木', category: 'アウター', count: 28 }
            ],
            photos: [
                { id: 1, date: '2023-01-15', assignee: '田中', category: 'トップス', count: 30 },
                { id: 2, date: '2023-01-16', assignee: '佐藤', category: 'ボトムス', count: 25 },
                { id: 3, date: '2023-01-17', assignee: '鈴木', category: 'アウター', count: 20 }
            ],
            assignees: ['田中', '佐藤', '鈴木', '高橋', '伊藤'],
            categories: ['トップス', 'ボトムス', 'アウター', 'シューズ', 'アクセサリー']
        };
    }

    // データの保存
    saveData() {
        try {
            console.log('データ保存開始:', this.data);
            
            // 不要な古いデータをクリーンアップ
            this.cleanupOldData();
            
            // ローカルストレージの容量を確認
            if (!this.checkLocalStorageQuota()) {
                console.warn('ローカルストレージの容量が不足しています。');
                this.showNotification('ローカルストレージの容量が不足しています。データを減らすか、ブラウザのストレージをクリアしてください。', 'error');
                // データを減らして保存を試みる
                if (!this.reduceDataForStorage()) {
                    return false;
                }
            }
            
            // データ量の確認
            const maxAllowedMeasurements = 20000; // 最大20000件まで
            const maxAllowedPhotos = 3000; // 最大3000件まで
            
            if (this.data.measurements.length > maxAllowedMeasurements) {
                this.showNotification(`採寸データが多すぎます。最大${maxAllowedMeasurements}件までしか保存できません。`, 'error');
                return false;
            }
            
            if (this.data.photos.length > maxAllowedPhotos) {
                this.showNotification(`撮影データが多すぎます。最大${maxAllowedPhotos}件までしか保存できません。`, 'error');
                return false;
            }
            
            // データをチャンクに分割して保存
            const measurements = this.data.measurements;
            const photos = this.data.photos;
            
            // チャンクサイズ（500件ごと）
            const chunkSize = 500;
            
            // 採寸データをチャンクに分割して保存
            for (let i = 0; i < measurements.length; i += chunkSize) {
                const chunk = measurements.slice(i, i + chunkSize);
                const chunkKey = `sasageData_measurements_${Math.floor(i / chunkSize)}`;
                localStorage.setItem(chunkKey, JSON.stringify(chunk));
            }
            
            // 撮影データをチャンクに分割して保存
            for (let i = 0; i < photos.length; i += chunkSize) {
                const chunk = photos.slice(i, i + chunkSize);
                const chunkKey = `sasageData_photos_${Math.floor(i / chunkSize)}`;
                localStorage.setItem(chunkKey, JSON.stringify(chunk));
            }
            
            // メタデータの保存
            const metadata = {
                measurementsCount: measurements.length,
                photosCount: photos.length,
                chunkSize: chunkSize,
                assignees: this.data.assignees,
                categories: this.data.categories
            };
            localStorage.setItem('sasageData_metadata', JSON.stringify(metadata));
            
            // 古いデータを削除
            const oldData = localStorage.getItem('sasageData');
            if (oldData) {
                localStorage.removeItem('sasageData');
            }
            
            console.log('データ保存完了');
            return true;
        } catch (error) {
            console.error('データの保存に失敗しました:', error);
            
            // 容量超過エラーの場合
            if (error.name === 'QuotaExceededError') {
                console.log('容量超過エラーが発生しました。');
                this.showNotification('容量超過エラーが発生しました。データを減らすか、ブラウザのストレージをクリアしてください。', 'error');
            }
            
            return false;
        }
    }
    
    // ローカルストレージの容量を確認
    checkLocalStorageQuota() {
        try {
            const testKey = 'sasage_quota_test';
            const testValue = 'x'.repeat(1024); // 1KBのテストデータ
            localStorage.setItem(testKey, testValue);
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                return false;
            }
            // その他のエラーは無視
            return true;
        }
    }
    
    // ローカルストレージに保存するためにデータを減らす
    reduceDataForStorage() {
        // 古いデータを削除して容量を確保
        const maxMeasurements = 20000; // 最大20000件まで
        const maxPhotos = 3000; // 最大3000件まで
        
        let reduced = false;
        
        if (this.data.measurements.length > maxMeasurements) {
            this.data.measurements = this.data.measurements.slice(-maxMeasurements);
            console.log(`採寸データを${maxMeasurements}件に減らしました。`);
            this.showNotification(`採寸データを${maxMeasurements}件に減らしました。`, 'warning');
            reduced = true;
        }
        
        if (this.data.photos.length > maxPhotos) {
            this.data.photos = this.data.photos.slice(-maxPhotos);
            console.log(`撮影データを${maxPhotos}件に減らしました。`);
            this.showNotification(`撮影データを${maxPhotos}件に減らしました。`, 'warning');
            reduced = true;
        }
        
        return reduced;
    }
    
    // 通知の表示
    showNotification(message, type = 'info') {
        // 既存の通知を削除
        const existingAlert = document.querySelector('.alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        // 新しい通知を作成
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        
        // 通知のスタイルを改善
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            transform: translateX(0);
            transition: transform 0.3s ease, opacity 0.3s ease;
        `;
        
        // タイプ別の背景色
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3',
            warning: '#FF9800'
        };
        
        alert.style.backgroundColor = colors[type] || colors.info;
        alert.style.color = 'white';
        
        alert.textContent = message;

        // bodyの先頭に通知を追加
        document.body.insertBefore(alert, document.body.firstChild);

        // 3秒後に通知をスライドアウトさせて削除
        setTimeout(() => {
            alert.style.transform = 'translateX(100%)';
            alert.style.opacity = '0';
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 300);
        }, 3000);
    }
    
    // 古いデータをクリーンアップ
    cleanupOldData() {
        // 古い形式のデータを削除
        const oldData = localStorage.getItem('sasageData');
        if (oldData) {
            localStorage.removeItem('sasageData');
        }
        
        // 古いメタデータを削除
        const oldMetadata = localStorage.getItem('sasageData_metadata_old');
        if (oldMetadata) {
            localStorage.removeItem('sasageData_metadata_old');
        }
        
        // 古いチャンクデータを削除
        this.cleanupChunkData();
    }
    
    // チャンクデータをクリーンアップ
    cleanupChunkData() {
        // 既存のチャンクデータを削除
        for (let i = 0; i < 100; i++) { // 最大100チャンクまで削除
            const measurementChunkKey = `sasageData_measurements_${i}`;
            const photoChunkKey = `sasageData_photos_${i}`;
            
            if (localStorage.getItem(measurementChunkKey)) {
                localStorage.removeItem(measurementChunkKey);
            }
            
            if (localStorage.getItem(photoChunkKey)) {
                localStorage.removeItem(photoChunkKey);
            }
        }
    }

    // 採寸データの追加
    addMeasurement(measurement) {
        // IDがなければ生成
        if (!measurement.id) {
            measurement.id = Date.now();
        }
        this.data.measurements.push(measurement);
        return true; // 保存はチャンク処理の最後に一括で行う
    }

    // 撮影データの追加
    addPhoto(photo) {
        // IDがなければ生成
        if (!photo.id) {
            photo.id = Date.now();
        }
        this.data.photos.push(photo);
        return true; // 保存はチャンク処理の最後に一括で行う
    }

    // フィルターに基づいたデータの取得
    getFilteredData(filters = {}) {
        let measurements = [...this.data.measurements];
        let photos = [...this.data.photos];

        // 日付フィルター
        if (filters.startDate) {
            measurements = measurements.filter(item => item.date >= filters.startDate);
            photos = photos.filter(item => item.date >= filters.startDate);
        }

        if (filters.endDate) {
            measurements = measurements.filter(item => item.date <= filters.endDate);
            photos = photos.filter(item => item.date <= filters.endDate);
        }

        // 担当者フィルター
        if (filters.assignee) {
            measurements = measurements.filter(item => item.assignee === filters.assignee);
            photos = photos.filter(item => item.assignee === filters.assignee);
        }

        // カテゴリフィルター
        if (filters.category) {
            measurements = measurements.filter(item => item.category === filters.category);
            photos = photos.filter(item => item.category === filters.category);
        }

        return {
            measurements,
            photos
        };
    }

    // 月別集計データの取得
    getMonthlySummary(filters = {}) {
        const filteredData = this.getFilteredData(filters);
        
        // 月別集計の初期化
        const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
        const measurementsByMonth = new Array(12).fill(0);
        const photosByMonth = new Array(12).fill(0);

        // 採寸データの集計
        filteredData.measurements.forEach(item => {
            const month = new Date(item.date).getMonth();
            measurementsByMonth[month] += item.count || 0;
        });

        // 撮影データの集計
        filteredData.photos.forEach(item => {
            const month = new Date(item.date).getMonth();
            photosByMonth[month] += item.count || 0;
        });

        return {
            months,
            measurements: measurementsByMonth,
            photos: photosByMonth
        };
    }

    // 日別集計データの取得
    getDailySummary(filters = {}) {
        const filteredData = this.getFilteredData(filters);
        
        // 日付のリストを作成（フィルター範囲内）
        let dates = [];
        if (filters.startDate && filters.endDate) {
            const start = new Date(filters.startDate);
            const end = new Date(filters.endDate);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d).toISOString().split('T')[0]);
            }
        } else {
            // デフォルトでは最近7日間
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                dates.push(d.toISOString().split('T')[0]);
            }
        }

        // 日別集計の初期化
        const measurementsByDay = new Array(dates.length).fill(0);
        const photosByDay = new Array(dates.length).fill(0);

        // 採寸データの集計
        filteredData.measurements.forEach(item => {
            const dateIndex = dates.indexOf(item.date);
            if (dateIndex !== -1) {
                measurementsByDay[dateIndex] += item.count || 0;
            }
        });

        // 撮影データの集計
        filteredData.photos.forEach(item => {
            const dateIndex = dates.indexOf(item.date);
            if (dateIndex !== -1) {
                photosByDay[dateIndex] += item.count || 0;
            }
        });

        // 日付を表示用に変換
        const displayDates = dates.map(date => {
            const d = new Date(date);
            return `${d.getMonth() + 1}/${d.getDate()}日`;
        });

        return {
            days: displayDates,
            measurements: measurementsByDay,
            photos: photosByDay
        };
    }

    // 担当者別集計データの取得
    getAssigneeSummary(filters = {}) {
        const filteredData = this.getFilteredData(filters);
        
        // 担当者リストの作成
        const assignees = [...new Set([
            ...filteredData.measurements.map(item => item.assignee),
            ...filteredData.photos.map(item => item.assignee)
        ])].filter(assignee => assignee); // 空の担当者を除外
        
        // 担当者別集計
        const summary = assignees.map(assignee => {
            const measurements = filteredData.measurements
                .filter(item => item.assignee === assignee)
                .reduce((sum, item) => sum + (item.count || 0), 0);
                
            const photos = filteredData.photos
                .filter(item => item.assignee === assignee)
                .reduce((sum, item) => sum + (item.count || 0), 0);
                
            const total = measurements + photos;
            const completionRate = total > 0 ? Math.round((measurements / total) * 100) : 0;
            
            return {
                assignee,
                measurements,
                photos,
                completionRate
            };
        });
        
        return summary;
    }

    // カテゴリ別集計データの取得
    getCategorySummary(filters = {}) {
        const filteredData = this.getFilteredData(filters);
        
        // カテゴリリストの作成
        const categories = [...new Set([
            ...filteredData.measurements.map(item => item.category),
            ...filteredData.photos.map(item => item.category)
        ])].filter(category => category); // 空のカテゴリを除外
        
        // カテゴリ別集計
        const summary = categories.map(category => {
            const measurements = filteredData.measurements
                .filter(item => item.category === category)
                .reduce((sum, item) => sum + (item.count || 0), 0);
                
            const photos = filteredData.photos
                .filter(item => item.category === category)
                .reduce((sum, item) => sum + (item.count || 0), 0);
                
            const total = measurements + photos;
            const completionRate = total > 0 ? Math.round((measurements / total) * 100) : 0;
            
            return {
                category,
                measurements,
                photos,
                completionRate
            };
        });
        
        return summary;
    }

    // サマリーデータの取得
    getSummary(filters = {}) {
        const filteredData = this.getFilteredData(filters);
        
        const totalMeasurements = filteredData.measurements.reduce((sum, item) => sum + (item.count || 0), 0);
        const totalPhotos = filteredData.photos.reduce((sum, item) => sum + (item.count || 0), 0);
        const total = totalMeasurements + totalPhotos;
        const completionRate = total > 0 ? Math.round((totalMeasurements / total) * 100) : 0;
        
        return {
            measurements: totalMeasurements,
            photos: totalPhotos,
            completionRate
        };
    }

    // データの削除
    deleteMeasurement(id) {
        const index = this.data.measurements.findIndex(item => item.id == id);
        if (index !== -1) {
            this.data.measurements.splice(index, 1);
            return this.saveData();
        }
        return false;
    }

    // 撮影データの削除
    deletePhoto(id) {
        const index = this.data.photos.findIndex(item => item.id == id);
        if (index !== -1) {
            this.data.photos.splice(index, 1);
            return this.saveData();
        }
        return false;
    }

    // すべてのデータを取得
    getAllData() {
        return {
            measurements: [...this.data.measurements],
            photos: [...this.data.photos]
        };
    }

    // Firebase連携（ダミー実装）
    async syncWithFirebase() {
        // 実際のFirebase連携はfirebase-config.jsで実装
        console.log('Firebase連携中...');
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('Firebase連携完了');
                resolve(true);
            }, 1000);
        });
    }
    
    // 文字化けデータのクリーニング
    cleanCorruptedData(data) {
        return data.filter(item => {
            // 文字化けの兆候をチェック
            const keys = Object.keys(item);
            
            // キーに不正な文字が含まれている場合はスキップ
            for (const key of keys) {
                // IDや日付などの正常なキーは除外
                if (key === 'id' || key === 'date' || key === 'assignee' || key === 'category' || key === 'count') {
                    continue;
                }
                
                if (this.isCorruptedText(key)) {
                    console.log('文字化けデータを検出しました（キー）:', item);
                    return false;
                }
            }
            
            // 値に不正な文字が含まれている場合はスキップ
            for (const [key, value] of Object.entries(item)) {
                // IDは数値なのでスキップ
                if (key === 'id') {
                    continue;
                }
                
                if (typeof value === 'string' && this.isCorruptedText(value)) {
                    console.log('文字化けデータを検出しました（値）:', item);
                    return false;
                }
            }
            
            // 必須フィールドの検証
            if (!item.date || !item.assignee || !item.category || isNaN(item.count)) {
                console.log('必須フィールドが不足しているデータをスキップ:', item);
                return false;
            }
            
            // 日付形式の検証
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(item.date)) {
                console.log('不正な日付形式のデータをスキップ:', item);
                return false;
            }
            
            // 担当者名の検証
            if (item.assignee.length < 2 || item.assignee === '派遣' || item.assignee === 'パート' || item.assignee === 'アルバイト') {
                console.log('不正な担当者名のデータをスキップ:', item);
                return false;
            }
            
            // カテゴリの検証
            if (item.category.length > 50 || item.category.includes('バーコード') || item.category.includes('barcode')) {
                console.log('不正なカテゴリのデータをスキップ:', item);
                return false;
            }
            
            // 点数の検証
            if (item.count <= 0) {
                console.log('不正な点数のデータをスキップ:', item);
                return false;
            }
            
            return true;
        });
    }
    
    // 文字化けテキストの検出
    isCorruptedText(text) {
        if (typeof text !== 'string') return false;
        
        // 空文字や短い文字列は文字化けではない
        if (text.length < 3) return false;
        
        // 正常な日本語を含む場合は文字化けではない
        const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;
        if (japaneseRegex.test(text)) {
            // 日本語を含み、かつ不正な文字が少なければ文字化けではない
            const corruptedChars = [String.fromCharCode(0xFFFD), '~', '~~'];
            let corruptedCount = 0;
            
            for (const char of corruptedChars) {
                if (text.includes(char)) {
                    corruptedCount++;
                }
            }
            
            // 不正な文字が全体の30%以上含まれている場合は文字化けと判定
            return (corruptedCount / text.length) > 0.3;
        }
        
        // 不正な文字（置換文字）をチェック
        const corruptedChars = [String.fromCharCode(0xFFFD), '~', '~~'];
        for (const char of corruptedChars) {
            if (text.includes(char)) {
                return true;
            }
        }
        
        // 不正なバイト列のパターンをチェック
        const corruptedPatterns = [
            /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/, // 制御文字
        ];
        
        for (const pattern of corruptedPatterns) {
            if (pattern.test(text)) {
                return true;
            }
        }
        
        return false;
    }
}

// グローバルインスタンスの作成
const dataManager = new DataManager();