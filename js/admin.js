// 管理ページ用のJavaScriptファイル

// iconv-liteライブラリの読み込み（ブラウザ環境では使用不可のため、代替実装を使用）
// 実際のプロジェクトでは、ブラウザ用のiconv-liteライブラリを使用する必要があります

class AdminPage {
    constructor() {
        this.dataManager = new DataManager();
        this.init();
    }

    async init() {
        await this.dataManager.initialize();
        this.bindEvents();
        this.loadDataList();
        this.initDragAndDrop();
    }

    bindEvents() {
        // タブ切り替え
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // CSVアップロード
        const uploadCsvBtn = document.getElementById('upload-csv');
        if (uploadCsvBtn) {
            uploadCsvBtn.addEventListener('click', () => {
                this.uploadCSV();
            });
        }

        // 手動データ追加
        const addManualDataBtn = document.getElementById('add-manual-data');
        if (addManualDataBtn) {
            addManualDataBtn.addEventListener('click', () => {
                this.addManualData();
            });
        }

        // CSVエクスポート
        const exportCsvBtn = document.getElementById('export-csv');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                this.exportCSV();
            });
        }

        // データ更新
        const refreshDataBtn = document.getElementById('refresh-data');
        if (refreshDataBtn) {
            refreshDataBtn.addEventListener('click', () => {
                this.loadDataList();
            });
        }

        // データタイプ変更時のフィルター
        const manageTypeSelect = document.getElementById('manage-type');
        if (manageTypeSelect) {
            manageTypeSelect.addEventListener('change', () => {
                this.loadDataList();
            });
        }

        // Firebase同期ボタン
        const syncFirebaseBtn = document.getElementById('sync-firebase');
        if (syncFirebaseBtn) {
            syncFirebaseBtn.addEventListener('click', () => {
                this.syncWithFirebase();
            });
        }

        // ファイル選択ダイアログ
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('click', () => {
                document.getElementById('csv-file').click();
            });
        }

        // ファイル入力の変更イベント（CSVアップロード用）
        const fileInput = document.getElementById('csv-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                // ファイル選択時にUIを更新する場合の処理をここに追加可能
                console.log('ファイルが選択されました:', e.target.files.length);
            });
        }

        // デバッグ機能：ローカルストレージクリア
        const clearStorageBtn = document.getElementById('clear-storage');
        if (clearStorageBtn) {
            clearStorageBtn.addEventListener('click', () => {
                this.clearLocalStorage();
            });
        }

        // デバッグ機能：ローカルストレージ表示
        const showStorageBtn = document.getElementById('show-storage');
        if (showStorageBtn) {
            showStorageBtn.addEventListener('click', () => {
                this.showLocalStorage();
            });
        }
    }

    // ドラッグ＆ドロップの初期化
    initDragAndDrop() {
        const dropZone = document.getElementById('drop-zone');
        if (!dropZone) return;

        // ドラッグオーバーイベント
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('dragover');
            });
        });

        // ドラッグリーブイベント
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('dragover');
            });
        });

        // ドロップイベント
        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length) {
                this.handleDroppedFiles(files);
            }
        });

        // ファイル入力の変更イベント
        const fileInput = document.getElementById('csv-file');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length) {
                    this.handleDroppedFiles(e.target.files);
                }
            });
        }
    }

    // ドロップされたファイルの処理
    handleDroppedFiles(files) {
        const file = files[0];
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            this.showNotification('CSVファイルを選択してください', 'error');
            return;
        }

        const dataType = document.getElementById('drop-data-type')?.value || 'measurements';
        this.uploadCSVFile(file, dataType);
    }

    switchTab(tabName) {
        // すべてのタブコンテンツを非表示
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
        });

        // すべてのタブからactiveクラスを削除
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // 選択されたタブを表示
        document.getElementById(`${tabName}-tab`).style.display = 'block';
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    }

    // CSVアップロード処理
    uploadCSV() {
        const fileInput = document.getElementById('csv-file');
        const dataType = document.getElementById('data-type').value;

        if (!fileInput || !fileInput.files || !fileInput.files.length) {
            this.showNotification('ファイルを選択してください', 'error');
            return;
        }

        const file = fileInput.files[0];
        if (!file) {
            this.showNotification('ファイルを選択してください', 'error');
            return;
        }

        // ファイルタイプの確認
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            this.showNotification('CSVファイルを選択してください', 'error');
            return;
        }

        this.uploadCSVFile(file, dataType);
    }

    // CSVファイルのアップロード処理
    uploadCSVFile(file, dataType) {
        console.log('CSVファイルアップロード開始:', file.name, dataType);
        
        // プログレスバーの表示
        this.showProgress(true);
        
        // 複数のエンコーディングで試す
        const encodings = ['UTF-8', 'Shift_JIS', 'UTF-16'];
        
        // エンコーディング検出を試みる
        const detectEncoding = (arrayBuffer) => {
            // バイト配列の先頭バイトをチェック
            const bytes = new Uint8Array(arrayBuffer.slice(0, 100)); // 最初の100バイトをチェック
            
            // BOMのチェック
            if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
                return 'UTF-16';
            }
            if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
                return 'UTF-16BE';
            }
            if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
                return 'UTF-8';
            }
            
            // Shift-JISの可能性をチェック（より詳細な判定）
            let shiftJisScore = 0;
            let utf8Score = 0;
            
            for (let i = 0; i < bytes.length - 1; i++) {
                const byte = bytes[i];
                const nextByte = bytes[i + 1];
                
                // Shift-JISの特徴的なバイト範囲をチェック
                if ((byte >= 0x81 && byte <= 0x9F) || (byte >= 0xE0 && byte <= 0xEF)) {
                    // 次のバイトが適切な範囲にあるかチェック
                    if ((nextByte >= 0x40 && nextByte <= 0x7E) || (nextByte >= 0x80 && nextByte <= 0xFC)) {
                        shiftJisScore++;
                    }
                }
                
                // UTF-8の特徴的なバイト範囲をチェック
                if (byte >= 0xC0 && byte <= 0xDF) {
                    // 2バイト文字のチェック
                    if (nextByte >= 0x80 && nextByte <= 0xBF) {
                        utf8Score++;
                    }
                } else if (byte >= 0xE0 && byte <= 0xEF) {
                    // 3バイト文字のチェック
                    if (nextByte >= 0x80 && nextByte <= 0xBF && 
                        i + 2 < bytes.length && bytes[i + 2] >= 0x80 && bytes[i + 2] <= 0xFC) {
                        utf8Score++;
                    }
                }
            }
            
            console.log('エンコーディングスコア - Shift_JIS:', shiftJisScore, 'UTF-8:', utf8Score);
            
            if (shiftJisScore > utf8Score) {
                return 'Shift_JIS';
            }
            
            // デフォルトはUTF-8
            return 'UTF-8';
        };
        
        // Shift-JISデコーダーの作成（テキストエンコーディングAPIを使用）
        const decodeShiftJIS = (arrayBuffer) => {
            // ブラウザがTextDecoderをサポートしているかチェック
            if (typeof TextDecoder !== 'undefined') {
                try {
                    const decoder = new TextDecoder('shift-jis');
                    return decoder.decode(arrayBuffer);
                } catch (e) {
                    console.error('Shift-JISデコードエラー:', e);
                    // フォールバックとしてUTF-8でデコードを試みる
                    const decoder = new TextDecoder('utf-8');
                    return decoder.decode(arrayBuffer);
                }
            } else {
                // TextDecoderがサポートされていない場合は、UTF-8でデコードを試みる
                const decoder = new TextDecoder('utf-8');
                return decoder.decode(arrayBuffer);
            }
        };
        
        const tryEncoding = (index) => {
            if (index >= encodings.length) {
                console.error('すべてのエンコーディングで読み込みに失敗しました');
                this.showNotification('❌ ファイルの読み込みに失敗しました。対応していない文字エンコーディングです。', 'error');
                this.showProgress(false);
                return;
            }
            
            const reader = new FileReader();
            const encoding = encodings[index];
            
            reader.onload = (e) => {
                try {
                    let csv = e.target.result;
                    console.log(`${encoding}で読み込み成功`);
                    
                    // BOMの除去
                    if (csv.charCodeAt(0) === 0xFEFF) {
                        csv = csv.slice(1);
                    }
                    
                    // チャンク処理でCSVを解析
                    this.parseCSVInChunks(csv, dataType, (data, successCount) => {
                        if (data.length === 0) {
                            // データが取得できなければ次のエンコーディングを試す
                            console.log(`${encoding}では有効なデータを取得できませんでした`);
                            tryEncoding(index + 1);
                            return;
                        }
                        
                        console.log('データ保存開始');
                        const saveResult = this.dataManager.saveData();
                        console.log('データ保存結果:', saveResult);
                        
                        // アップロード完了メッセージをより明確に
                        this.showNotification(`🎉 アップロード完了！ ${successCount}件のデータを正常に追加しました`, 'success');
                        this.loadDataList();
                        this.showProgress(false);
                        
                        // ダッシュボードにデータ反映を通知
                        console.log('ダッシュボード更新通知開始');
                        this.notifyDashboardUpdate();
                        console.log('ダッシュボード更新通知完了');
                    });
                } catch (error) {
                    console.error(`${encoding}での解析エラー:`, error);
                    tryEncoding(index + 1);
                }
            };

            reader.onerror = () => {
                console.error(`${encoding}でのファイル読み込みエラー`);
                tryEncoding(index + 1);
            };

            // 指定されたエンコーディングで読み込み
            try {
                if (encoding === 'Shift_JIS') {
                    // Shift-JISの場合は特別な処理
                    const readerForDetection = new FileReader();
                    readerForDetection.onload = (e) => {
                        const arrayBuffer = e.target.result;
                        const detectedEncoding = detectEncoding(arrayBuffer);
                        console.log('検出されたエンコーディング:', detectedEncoding);
                        
                        // Shift-JISとしてデコード
                        if (detectedEncoding === 'Shift_JIS') {
                            try {
                                const csv = decodeShiftJIS(arrayBuffer);
                                console.log('Shift-JISデコード成功');
                                
                                // BOMの除去
                                let cleanCsv = csv;
                                if (cleanCsv.charCodeAt(0) === 0xFEFF) {
                                    cleanCsv = cleanCsv.slice(1);
                                }
                                
                                // チャンク処理でCSVを解析
                                this.parseCSVInChunks(cleanCsv, dataType, (data, successCount) => {
                                    if (data.length === 0) {
                                        // データが取得できなければ次のエンコーディングを試す
                                        console.log(`${detectedEncoding}では有効なデータを取得できませんでした`);
                                        tryEncoding(index + 1);
                                        return;
                                    }
                                    
                                    console.log('データ保存開始');
                                    const saveResult = this.dataManager.saveData();
                                    console.log('データ保存結果:', saveResult);
                                    
                                    // アップロード完了メッセージをより明確に
                                    this.showNotification(`🎉 アップロード完了！ ${successCount}件のデータを正常に追加しました`, 'success');
                                    this.loadDataList();
                                    this.showProgress(false);
                                    
                                    // ダッシュボードにデータ反映を通知
                                    console.log('ダッシュボード更新通知開始');
                                    this.notifyDashboardUpdate();
                                    console.log('ダッシュボード更新通知完了');
                                });
                            } catch (decodeError) {
                                console.error('Shift-JISデコードエラー:', decodeError);
                                tryEncoding(index + 1);
                            }
                        } else {
                            // 他のエンコーディングの場合は通常の処理
                            const finalReader = new FileReader();
                            finalReader.onload = (e) => {
                                let csv = e.target.result;
                                console.log(`${detectedEncoding}で読み込み成功`);
                                
                                // BOMの除去
                                if (csv.charCodeAt(0) === 0xFEFF) {
                                    csv = csv.slice(1);
                                }
                                
                                // チャンク処理でCSVを解析
                                this.parseCSVInChunks(csv, dataType, (data, successCount) => {
                                    if (data.length === 0) {
                                        // データが取得できなければ次のエンコーディングを試す
                                        console.log(`${detectedEncoding}では有効なデータを取得できませんでした`);
                                        tryEncoding(index + 1);
                                        return;
                                    }
                                    
                                    console.log('データ保存開始');
                                    const saveResult = this.dataManager.saveData();
                                    console.log('データ保存結果:', saveResult);
                                    
                                    // アップロード完了メッセージをより明確に
                                    this.showNotification(`🎉 アップロード完了！ ${successCount}件のデータを正常に追加しました`, 'success');
                                    this.loadDataList();
                                    this.showProgress(false);
                                    
                                    // ダッシュボードにデータ反映を通知
                                    console.log('ダッシュボード更新通知開始');
                                    this.notifyDashboardUpdate();
                                    console.log('ダッシュボード更新通知完了');
                                });
                            };
                            
                            finalReader.onerror = () => {
                                console.error(`${detectedEncoding}でのファイル読み込みエラー`);
                                tryEncoding(index + 1);
                            };
                            
                            finalReader.readAsText(new Blob([arrayBuffer]), detectedEncoding);
                        }
                    };
                    readerForDetection.onerror = () => {
                        console.error('エンコーディング検出エラー');
                        tryEncoding(index + 1);
                    };
                    readerForDetection.readAsArrayBuffer(file);
                } else {
                    reader.readAsText(file, encoding);
                }
            } catch (e) {
                console.error(`${encoding}での読み込み試行エラー:`, e);
                tryEncoding(index + 1);
            }
        };
        
        // 最初のエンコーディングから試す
        tryEncoding(0);
    }

    // CSV解析
    parseCSV(csv) {
        console.log('CSV解析開始');
        
        // BOMの除去
        if (csv.charCodeAt(0) === 0xFEFF) {
            csv = csv.slice(1);
        }
        
        const lines = csv.split(/\r?\n/);
        console.log('行数:', lines.length);
        
        // 空行を除去
        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        console.log('空行を除いた行数:', nonEmptyLines.length);
        
        if (nonEmptyLines.length < 2) {
            console.warn('CSVデータが不正です。ヘッダーとデータ行が必要です。');
            return [];
        }
        
        // 最初の行をヘッダーとして解析
        const firstLine = nonEmptyLines[0];
        // カンマ区切りまたはタブ区切りを検出
        const delimiter = firstLine.includes(',') ? ',' : '\t';
        let headers = firstLine.split(delimiter).map(h => {
            // ヘッダーから余分な引用符やスペースを除去
            return h.trim().replace(/^["']|["']$/g, '');
        });
        console.log('ヘッダー:', headers);
        
        // 文字化けヘッダーの検出
        if (this.isCorruptedHeader(headers)) {
            console.warn('文字化けしたヘッダーが検出されました。データをスキップします。');
            return [];
        }
        
        // ヘッダーの文字化け対策 - より強力なパターンマッチング
        const normalizedHeaders = headers.map(header => {
            // 文字化けしている可能性のあるヘッダーを修正
            if (header.match(/(日付|date|日|iID|ID)/i)) {
                return 'date';
            }
            if (header.match(/(担当者|assignee|氏名|H|B|担当|作業者|作業担当者)/i)) {
                return 'assignee';
            }
            if (header.match(/(カテゴリ|category|分類|R\[h|種別|工程|作業工程)/i)) {
                return 'category';
            }
            if (header.match(/(点数|count|数量|b\)|点|数|時間|作業時間)/i)) {
                return 'count';
            }
            return header;
        });
        
        console.log('正規化されたヘッダー:', normalizedHeaders);
        
        // 必須フィールドの存在確認
        const dateIndex = normalizedHeaders.findIndex(h => h === 'date');
        const assigneeIndex = normalizedHeaders.findIndex(h => h === 'assignee');
        const categoryIndex = normalizedHeaders.findIndex(h => h === 'category');
        const countIndex = normalizedHeaders.findIndex(h => h === 'count');
        
        console.log('必須フィールドのインデックス:', {
            date: dateIndex,
            assignee: assigneeIndex,
            category: categoryIndex,
            count: countIndex
        });
        
        if (dateIndex === -1 || assigneeIndex === -1 || categoryIndex === -1 || countIndex === -1) {
            console.warn('必須フィールドが不足しています:', {
                date: dateIndex,
                assignee: assigneeIndex,
                category: categoryIndex,
                count: countIndex
            });
            return [];
        }
        
        const data = [];

        for (let i = 1; i < nonEmptyLines.length; i++) {
            const line = nonEmptyLines[i];
            // 空行をスキップ
            if (line.trim() === '') continue;
            
            const values = line.split(delimiter);
            
            // 値の数がヘッダーの数と一致しない場合はスキップ
            if (values.length !== headers.length) {
                console.log(`行${i}は列数が不一致のためスキップ:`, values);
                continue;
            }
            
            console.log(`行${i}の値:`, values);
            
            // 必須フィールドの値を取得
            const dateValue = values[dateIndex] ? values[dateIndex].trim().replace(/^["']|["']$/g, '') : '';
            const assigneeValue = values[assigneeIndex] ? values[assigneeIndex].trim().replace(/^["']|["']$/g, '') : '';
            const categoryValue = values[categoryIndex] ? values[categoryIndex].trim().replace(/^["']|["']$/g, '') : '';
            const countValue = values[countIndex] ? values[countIndex].trim().replace(/^["']|["']$/g, '') : '';
            
            const row = {
                date: dateValue,
                assignee: assigneeValue,
                category: categoryValue,
                count: countValue
            };
            
            console.log(`行${i}の解析結果:`, row);
            
            // 文字化けデータの検出
            if (this.isCorruptedRow(row)) {
                console.log(`行${i}は文字化けデータのためスキップ:`, row);
                continue;
            }
            
            // 数値フィールドの変換
            if (row.count !== undefined) {
                row.count = parseInt(row.count, 10);
                console.log(`count変換後:`, row.count);
            }
            
            // 必須フィールドの検証
            if (row.date && row.assignee && row.category && !isNaN(row.count) && row.count > 0) {
                // 日付形式の正規化
                if (row.date) {
                    // 日付に時間が含まれている場合は除去または分離
                    if (row.date.includes(' ')) {
                        // 時間部分を削除して日付のみを取得
                        const datePart = row.date.split(' ')[0];
                        // 日付形式の確認と変換
                        if (datePart.includes('/')) {
                            const dateParts = datePart.split('/');
                            if (dateParts.length >= 3) {
                                // YYYY-MM-DD形式に変換
                                const year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                                row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                            }
                        } else {
                            row.date = datePart;
                        }
                    } else if (row.date.includes('/')) {
                        const dateParts = row.date.split('/');
                        if (dateParts.length >= 3) {
                            // YYYY-MM-DD形式に変換
                            const year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                            row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                        }
                    }
                }
                
                // 担当者名のクリーニング
                if (row.assignee) {
                    // 担当者名が極端に短い場合はスキップ
                    if (row.assignee.length < 2) {
                        console.log(`行${i}は担当者名が短すぎるためスキップ:`, row);
                        continue;
                    }
                    
                    // 担当者名が"派遣"などの一般的な単語の場合はスキップ
                    if (row.assignee === '派遣' || row.assignee === 'パート' || row.assignee === 'アルバイト') {
                        console.log(`行${i}は担当者名が一般的な単語のためスキップ:`, row);
                        continue;
                    }
                }
                
                // カテゴリのクリーニング
                if (row.category) {
                    // カテゴリが長すぎる場合はスキップ
                    if (row.category.length > 50) {
                        console.log(`行${i}はカテゴリが長すぎるためスキップ:`, row);
                        continue;
                    }
                    
                    // カテゴリが"採寸"などの一般的な単語の場合はそのまま使用
                    // ただし、明らかに不要な情報（例：バーコード番号）は除外
                    if (row.category.includes('バーコード') || row.category.includes('barcode')) {
                        console.log(`行${i}はカテゴリに不要な情報が含まれているためスキップ:`, row);
                        continue;
                    }
                }
                
                // 日付の検証
                if (!row.date || row.date === 'undefined') {
                    console.log(`行${i}は日付が不正なためスキップ:`, row);
                    continue;
                }
                
                // 日付形式の最終確認
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(row.date)) {
                    console.log(`行${i}は日付形式が不正なためスキップ:`, row);
                    continue;
                }
                
                console.log(`行${i}は必須フィールドを満たしています`);
                data.push(row);
            } else {
                console.log(`行${i}は必須フィールドを満たしていません:`, {
                    date: row.date,
                    assignee: row.assignee,
                    category: row.category,
                    count: row.count
                });
            }
        }

        console.log('CSV解析完了。有効なデータ数:', data.length);
        return data;
    }

    // 手動データ追加
    addManualData() {
        const date = document.getElementById('manual-date').value;
        const assignee = document.getElementById('manual-assignee').value;
        const category = document.getElementById('manual-category').value;
        const count = parseInt(document.getElementById('manual-count').value, 10);
        const type = document.getElementById('manual-type').value;

        if (!date || !assignee || !category || !count) {
            this.showNotification('すべてのフィールドを入力してください', 'error');
            return;
        }

        const data = {
            date,
            assignee,
            category,
            count
        };

        if (type === 'measurements') {
            this.dataManager.addMeasurement(data);
        } else {
            this.dataManager.addPhoto(data);
        }

        this.dataManager.saveData();
        this.showNotification('データを追加しました', 'success');
        
        // ダッシュボードにデータ反映を通知
        this.notifyDashboardUpdate();
        
        // フォームをリセット
        document.getElementById('manual-date').value = '';
        document.getElementById('manual-assignee').value = '';
        document.getElementById('manual-category').value = '';
        document.getElementById('manual-count').value = '';
    }

    // CSVエクスポート
    exportCSV() {
        const csv = this.generateCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'sasage_data.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // CSV生成
    generateCSV() {
        const data = this.dataManager.data;
        let csv = 'date,assignee,category,count,type\n';
        
        // 採寸データ
        data.measurements.forEach(item => {
            if (item.date && item.assignee && item.category && item.count) {
                csv += `${item.date},${item.assignee},${item.category},${item.count},measurements\n`;
            }
        });
        
        // 撮影データ
        data.photos.forEach(item => {
            if (item.date && item.assignee && item.category && item.count) {
                csv += `${item.date},${item.assignee},${item.category},${item.count},photos\n`;
            }
        });
        
        return csv;
    }

    // データ一覧の読み込み
    loadDataList() {
        const dataList = document.getElementById('data-list');
        if (!dataList) return;

        const dataType = document.getElementById('manage-type').value;
        const data = this.dataManager.data;
        
        // 既存のデータをクリア
        dataList.innerHTML = '';

        // データの結合とソート
        let allData = [];
        
        if (dataType === 'all' || dataType === 'measurements') {
            data.measurements.forEach(item => {
                if (item.date && item.assignee && item.category && item.count) {
                    allData.push({ ...item, type: '採寸' });
                }
            });
        }
        
        if (dataType === 'all' || dataType === 'photos') {
            data.photos.forEach(item => {
                if (item.date && item.assignee && item.category && item.count) {
                    allData.push({ ...item, type: '撮影' });
                }
            });
        }
        
        // 日付でソート（新しい順）
        allData.sort((a, b) => new Date(b.date) - new Date(a.date));

        // データをテーブルに追加
        allData.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.date}</td>
                <td>${item.assignee}</td>
                <td>${item.category}</td>
                <td>${item.count}</td>
                <td>${item.type}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-btn" data-index="${index}" data-type="${item.type}">削除</button>
                </td>
            `;
            dataList.appendChild(row);
        });

        // 削除ボタンのイベントバインディング
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                const type = e.target.dataset.type;
                this.deleteData(index, type);
            });
        });
    }

    // データ削除
    deleteData(index, type) {
        if (confirm('このデータを削除してもよろしいですか？')) {
            if (type === '採寸') {
                this.dataManager.data.measurements.splice(index, 1);
            } else {
                this.dataManager.data.photos.splice(index, 1);
            }
            
            this.dataManager.saveData();
            this.showNotification('データを削除しました', 'success');
            this.loadDataList();
            
            // ダッシュボードにデータ反映を通知
            this.notifyDashboardUpdate();
        }
    }

    // Firebaseと同期
    async syncWithFirebase() {
        try {
            this.showNotification('Firebaseと同期中...', 'info');
            await this.dataManager.syncWithFirebase();
            this.showNotification('Firebaseとの同期が完了しました', 'success');
        } catch (error) {
            console.error('Firebase同期エラー:', error);
            this.showNotification('Firebaseとの同期に失敗しました', 'error');
        }
    }

    // ダッシュボードにデータ更新を通知
    notifyDashboardUpdate() {
        // ローカルストレージに更新フラグを設定
        localStorage.setItem('dashboardDataUpdated', Date.now().toString());
        
        // カスタムイベントを発火
        const event = new CustomEvent('dashboardDataUpdated');
        window.dispatchEvent(event);
        
        console.log('ダッシュボード更新通知を送信しました');
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

    // デバッグ機能：ローカルストレージクリア
    clearLocalStorage() {
        if (confirm('ローカルストレージのデータをすべて削除してもよろしいですか？')) {
            localStorage.clear();
            this.showNotification('ローカルストレージをクリアしました', 'success');
            this.loadDataList();
        }
    }

    // デバッグ機能：ローカルストレージ表示
    showLocalStorage() {
        const sasageData = localStorage.getItem('sasageData');
        if (sasageData) {
            const data = JSON.parse(sasageData);
            console.log('ローカルストレージのデータ:', data);
            alert('コンソールを開いてください。データをログに出力しました。');
        } else {
            console.log('ローカルストレージにデータがありません');
            alert('ローカルストレージにデータがありません');
        }
    }
    
    // 文字化けヘッダーの検出
    isCorruptedHeader(headers) {
        // 正常な日本語ヘッダーを含む場合は文字化けではない
        const validJapaneseHeaders = [
            '作業者', '工程', '作業日', '商品ID', 'バーコード', '開始日時', '終了日時', '作業時間', 
            '日付', '担当者', 'カテゴリ', '点数', '年月日', 'ID', '時間', '秒', 'バーコード番号',
            '商品', '作業', '開始', '終了', '時間'
        ];
        let validJapaneseCount = 0;
        
        for (const header of headers) {
            // 正常な日本語ヘッダーをチェック
            let isValidHeader = false;
            for (const validHeader of validJapaneseHeaders) {
                if (header.includes(validHeader)) {
                    isValidHeader = true;
                    validJapaneseCount++;
                    break;
                }
            }
            
            // 正常なヘッダーの場合は次のヘッダーをチェック
            if (isValidHeader) {
                continue;
            }
            
            // 不正な文字（置換文字）をチェック
            const corruptedChars = [String.fromCharCode(0xFFFD), '~', '~~'];
            for (const char of corruptedChars) {
                if (header.includes(char)) {
                    // 正常な日本語を含み、かつ不正な文字が少なければ文字化けではない
                    if (validJapaneseCount > 0) {
                        const corruptedCharCount = (header.match(new RegExp(char, 'g')) || []).length;
                        // 不正な文字が全体の30%以上含まれている場合は文字化けと判定
                        if ((corruptedCharCount / header.length) <= 0.3) {
                            continue;
                        }
                    }
                    // 不正な文字が少ない場合は文字化けではない
                    const corruptedCharCount = (header.match(new RegExp(char, 'g')) || []).length;
                    if (corruptedCharCount < 3) {
                        continue;
                    }
                    return true;
                }
            }
            
            // 不正なバイト列のパターンをチェック
            const corruptedPatterns = [
                /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/, // 制御文字
            ];
            
            for (const pattern of corruptedPatterns) {
                if (pattern.test(header)) {
                    // 正常な日本語を含み、かつ不正な文字が少なければ文字化けではない
                    if (validJapaneseCount > 0) {
                        const corruptedPatternCount = (header.match(pattern) || []).length;
                        // 不正な文字が全体の30%以上含まれている場合は文字化けと判定
                        if ((corruptedPatternCount / header.length) <= 0.3) {
                            continue;
                        }
                    }
                    // 不正な文字が少ない場合は文字化けではない
                    const corruptedPatternCount = (header.match(pattern) || []).length;
                    if (corruptedPatternCount < 3) {
                        continue;
                    }
                    return true;
                }
            }
        }
        
        // すべてのヘッダーが不正な場合のみ文字化けと判定
        return validJapaneseCount === 0 && headers.some(header => {
            // 空のヘッダーは不正
            if (!header) return true;
            
            // 非常に短いヘッダーは不正
            if (header.length < 2) return true;
            
            return false;
        });
    }
    
    // 文字化け行の検出
    isCorruptedRow(row) {
        for (const [key, value] of Object.entries(row)) {
            // キーに不正な文字が含まれている場合はスキップ
            if (this.isCorruptedText(key)) {
                return true;
            }
            
            // 値に不正な文字が含まれている場合はスキップ
            if (typeof value === 'string' && this.isCorruptedText(value)) {
                return true;
            }
        }
        return false;
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
    
    // チャンク処理でCSVを解析
    parseCSVInChunks(csv, dataType, callback) {
        console.log('チャンク処理でCSV解析開始');
        
        // BOMの除去
        if (csv.charCodeAt(0) === 0xFEFF) {
            csv = csv.slice(1);
        }
        
        const lines = csv.split(/\r?\n/);
        console.log('行数:', lines.length);
        
        // 空行を除去
        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        console.log('空行を除いた行数:', nonEmptyLines.length);
        
        if (nonEmptyLines.length < 2) {
            console.warn('CSVデータが不正です。ヘッダーとデータ行が必要です。');
            callback([], 0);
            return;
        }
        
        // 最初の行をヘッダーとして解析
        const firstLine = nonEmptyLines[0];
        // カンマ区切りまたはタブ区切りを検出
        const delimiter = firstLine.includes(',') ? ',' : '\t';
        let headers = firstLine.split(delimiter).map(h => {
            // ヘッダーから余分な引用符やスペースを除去
            return h.trim().replace(/^["']|["']$/g, '');
        });
        console.log('ヘッダー:', headers);
        
        // 文字化けヘッダーの検出
        if (this.isCorruptedHeader(headers)) {
            console.warn('文字化けしたヘッダーが検出されました。データをスキップします。');
            callback([], 0);
            return;
        }
        
        // ヘッダーの文字化け対策 - より強力なパターンマッチング
        const normalizedHeaders = headers.map(header => {
            // 文字化けしている可能性のあるヘッダーを修正
            if (header.match(/(日付|date|日|iID|ID)/i)) {
                return 'date';
            }
            if (header.match(/(担当者|assignee|氏名|H|B|担当|作業者|作業担当者)/i)) {
                return 'assignee';
            }
            if (header.match(/(カテゴリ|category|分類|R\[h|種別|工程|作業工程)/i)) {
                return 'category';
            }
            if (header.match(/(点数|count|数量|b\)|点|数|時間|作業時間)/i)) {
                return 'count';
            }
            return header;
        });
        
        // 必須フィールドの存在確認
        const dateIndex = normalizedHeaders.findIndex(h => h === 'date');
        const assigneeIndex = normalizedHeaders.findIndex(h => h === 'assignee');
        const categoryIndex = normalizedHeaders.findIndex(h => h === 'category');
        const countIndex = normalizedHeaders.findIndex(h => h === 'count');
        
        if (dateIndex === -1 || assigneeIndex === -1 || categoryIndex === -1 || countIndex === -1) {
            console.warn('必須フィールドが不足しています');
            callback([], 0);
            return;
        }
        
        // チャンクサイズと現在のインデックス
        const chunkSize = 5000; // 1回の処理で5000行（処理速度向上のため増加）
        let currentIndex = 1; // ヘッダー行をスキップ
        let successCount = 0;
        let processedData = [];
        
        // プログレスバーの更新間隔
        const progressUpdateInterval = 1000; // 1000行ごとにプログレスバーを更新
        let lastProgressUpdate = 0;
        
        // プログレスバーの更新
        this.updateProgress(0, nonEmptyLines.length - 1);
        
        // チャンク処理の関数
        const processChunk = () => {
            const endIndex = Math.min(currentIndex + chunkSize, nonEmptyLines.length);
            
            for (let i = currentIndex; i < endIndex; i++) {
                const line = nonEmptyLines[i];
                // 空行をスキップ
                if (line.trim() === '') continue;
                
                const values = line.split(delimiter);
                
                // 値の数がヘッダーの数と一致しない場合はスキップ
                if (values.length !== headers.length) {
                    continue;
                }
                
                // 必須フィールドの値を取得
                const dateValue = values[dateIndex] ? values[dateIndex].trim().replace(/^["']|["']$/g, '') : '';
                const assigneeValue = values[assigneeIndex] ? values[assigneeIndex].trim().replace(/^["']|["']$/g, '') : '';
                const categoryValue = values[categoryIndex] ? values[categoryIndex].trim().replace(/^["']|["']$/g, '') : '';
                const countValue = values[countIndex] ? values[countIndex].trim().replace(/^["']|["']$/g, '') : '';
                
                // 必須フィールドの検証（ログ出力を削減）
                if (!dateValue || !assigneeValue || !categoryValue || !countValue) {
                    continue;
                }
                
                const row = {
                    date: dateValue,
                    assignee: assigneeValue,
                    category: categoryValue,
                    count: parseInt(countValue, 10)
                };
                
                // 数値フィールドの検証
                if (isNaN(row.count) || row.count <= 0) {
                    continue;
                }
                
                // 日付形式の正規化（効率化のため簡略化）
                if (row.date.includes(' ')) {
                    row.date = row.date.split(' ')[0];
                }
                
                if (row.date.includes('/')) {
                    const dateParts = row.date.split('/');
                    if (dateParts.length >= 3) {
                        const year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                        row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                    }
                }
                
                if (row.date.includes('-')) {
                    const dateParts = row.date.split('-');
                    if (dateParts.length >= 3) {
                        const year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                        row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                    }
                }
                
                // 日付形式の最終確認
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(row.date)) {
                    continue;
                }
                
                // 担当者名のクリーニング（効率化のため簡略化）
                if (row.assignee.length < 2 || 
                    row.assignee === '派遣' || 
                    row.assignee === 'パート' || 
                    row.assignee === 'アルバイト') {
                    continue;
                }
                
                // カテゴリのクリーニング（効率化のため簡略化）
                if (row.category.length > 50 || 
                    row.category.includes('バーコード') || 
                    row.category.includes('barcode')) {
                    continue;
                }
                
                processedData.push(row);
                successCount++;
                
                // データをDataManagerに追加
                if (dataType === 'measurements') {
                    this.dataManager.addMeasurement(row);
                } else {
                    this.dataManager.addPhoto(row);
                }
            }
            
            // プログレスバーの更新（一定間隔ごとに更新）
            if (currentIndex - lastProgressUpdate >= progressUpdateInterval || endIndex >= nonEmptyLines.length) {
                this.updateProgress(endIndex - 1, nonEmptyLines.length - 1);
                lastProgressUpdate = endIndex - 1;
            }
            
            // 次のチャンクを処理
            currentIndex = endIndex;
            if (currentIndex < nonEmptyLines.length) {
                // 次のチャンクを非同期で処理（setTimeoutの遅延を削減）
                setTimeout(processChunk, 0);
            } else {
                // すべてのデータを処理完了
                // 最後に一括でデータを保存
                try {
                    const saveResult = this.dataManager.saveData();
                    console.log('データ保存結果:', saveResult);
                } catch (error) {
                    console.error('データ保存中にエラーが発生しました:', error);
                    // 容量超過エラーの場合、ユーザーに通知
                    if (error.name === 'QuotaExceededError') {
                        this.showNotification('❌ データの保存に失敗しました。ブラウザのストレージ容量を超えています。', 'error');
                    } else {
                        this.showNotification('❌ データの保存に失敗しました。', 'error');
                    }
                }
                
                callback(processedData, successCount);
            }
        };
        
        // 最初のチャンクを処理開始
        processChunk();
    }
    
    // プログレスバーの表示/非表示
    showProgress(show) {
        let progressBar = document.getElementById('upload-progress');
        if (!progressBar) {
            // プログレスバーが存在しない場合は作成
            progressBar = document.createElement('div');
            progressBar.id = 'upload-progress';
            progressBar.className = 'progress-bar';
            progressBar.innerHTML = `
                <div class="progress-container">
                    <div class="progress-bar-fill"></div>
                    <div class="progress-text">処理中...</div>
                </div>
            `;
            document.body.appendChild(progressBar);
        }
        
        progressBar.style.display = show ? 'block' : 'none';
    }
    
    // プログレスバーの更新
    updateProgress(current, total) {
        const progressBar = document.getElementById('upload-progress');
        if (progressBar) {
            const fill = progressBar.querySelector('.progress-bar-fill');
            const text = progressBar.querySelector('.progress-text');
            const percentage = Math.round((current / total) * 100);
            
            if (fill) {
                fill.style.width = `${percentage}%`;
            }
            
            if (text) {
                text.textContent = `処理中... ${current}/${total} (${percentage}%)`;
            }
        }
    }
}

// ページ読み込み完了時にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    window.adminPage = new AdminPage();
});