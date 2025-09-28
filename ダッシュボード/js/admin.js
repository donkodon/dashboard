// 管理ページ用のJavaScriptファイル

// iconv-liteライブラリの読み込み（ブラウザ環境では使用不可のため、代替実装を使用）
// 実際のプロジェクトでは、ブラウザ用のiconv-liteライブラリを使用する必要があります

class AdminPage {
    constructor() {
        // dataManagerをdata-manager.jsで定義されたグローバル変数を使用するように変更
        this.dataManager = dataManager;
        this.init();
    }
    async init() {
        await this.dataManager.initialize();
        // 商品データの読み込みを追加
        this.dataManager.loadProductData();
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
                this.uploadProductData(); // 修正: uploadCSVからuploadProductDataに変更
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
        
        // 商品分析機能を追加
        const runAnalysisBtn = document.getElementById('run-analysis');
        if (runAnalysisBtn) {
            runAnalysisBtn.addEventListener('click', () => {
                this.runProductAnalysis();
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
    async uploadCSV() {
        const fileInput = document.getElementById('csv-file');
        const dataType = document.getElementById('data-type').value;

        if (!fileInput || !fileInput.files || !fileInput.files.length) {
            this.showNotification('ファイルを選択してください', 'error');
            return;
        }

        const file = fileInput.files[0];
        await this.uploadCSVFile(file, dataType);
    }

    // CSVファイルアップロード処理（チャンク分割対応版）
    async uploadCSVFile(file, dataType) {
        if (!file) {
            this.showNotification('ファイルが選択されていません', 'error');
            return;
        }

        try {
            // プログレスバーを表示
            this.showProgressBar();
            
            // FileReaderでファイルを読み込む
            const text = await this.readFileAsText(file);
            
            // CSVをパース
            const parsedData = this.parseCSV(text);
            
            if (!parsedData || parsedData.length === 0) {
                this.showNotification('有効なデータが見つかりませんでした', 'error');
                this.hideProgressBar();
                return;
            }

            // チャンクサイズを2500に設定（20万行以上対応）
            const CHUNK_SIZE = 2500;
            const totalRows = parsedData.length;
            let processedRows = 0;
            
            console.log(`CSVファイルアップロード開始: ${totalRows}行, チャンクサイズ: ${CHUNK_SIZE}`);

            // データをチャンクに分割して処理
            for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
                const chunk = parsedData.slice(i, i + CHUNK_SIZE);
                
                // チャンクデータを検証
                const validData = this.validateCSVData(chunk, dataType);
                
                if (validData.valid.length > 0) {
                    // データを保存
                    this.dataManager.addData(validData.valid, dataType);
                }
                
                // 処理件数を更新
                processedRows += chunk.length;
                
                // プログレスバーを更新（1000行ごとに更新）
                if (i % 1000 === 0 || i + CHUNK_SIZE >= totalRows) {
                    const progress = Math.min(Math.round((processedRows / totalRows) * 100), 100);
                    this.updateProgressBar(progress, `処理中... (${processedRows}/${totalRows}行)`);
                }
                
                // UIの更新を許可するために短い待機時間を入れる
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            // データを保存
            this.dataManager.saveData();

            // プログレスバーを100%に更新
            this.updateProgressBar(100, '完了!');
            
            // 成功メッセージを表示
            this.showNotification(`🎉 アップロード完了！ ${processedRows}行のデータを追加しました`, 'success');
            
            // データリストを更新
            this.loadDataList();
            
            // ダッシュボードの更新イベントを発行
            window.dispatchEvent(new CustomEvent('dashboardDataUpdated'));
            
            // 1秒後にプログレスバーを非表示
            setTimeout(() => {
                this.hideProgressBar();
            }, 1000);
            
            console.log(`CSVファイルアップロード完了: ${processedRows}行処理`);
        } catch (error) {
            console.error('CSVファイルアップロードエラー:', error);
            this.showNotification(`❌ アップロード失敗: ${error.message}`, 'error');
            this.hideProgressBar();
        }
    }

    // FileReaderでファイルをテキストとして読み込む
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // CSVデータの検証
    validateCSVData(data, dataType) {
        const valid = [];
        const invalid = [];
        
        data.forEach(row => {
            // 基本的な検証
            if (row.date && row.assignee && row.category && !isNaN(row.count) && row.count > 0) {
                // 日付形式の検証
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (dateRegex.test(row.date)) {
                    valid.push(row);
                } else {
                    invalid.push(row);
                }
            } else {
                invalid.push(row);
            }
        });
        
        return { valid, invalid };
    }

    // プログレスバーを表示
    showProgressBar() {
        let progressBar = document.getElementById('upload-progress');
        if (!progressBar) {
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
        progressBar.style.display = 'block';
    }

    // プログレスバーを更新
    updateProgressBar(percentage, text) {
        const progressBar = document.getElementById('upload-progress');
        if (progressBar) {
            const fill = progressBar.querySelector('.progress-bar-fill');
            const textElement = progressBar.querySelector('.progress-text');
            
            if (fill) {
                fill.style.width = `${percentage}%`;
            }
            
            if (textElement) {
                textElement.textContent = text;
            }
        }
    }

    // プログレスバーを非表示
    hideProgressBar() {
        const progressBar = document.getElementById('upload-progress');
        if (progressBar) {
            progressBar.style.display = 'none';
        }
    }

    // CSV解析
    parseCSV(csv) {
        console.log('CSV解析開始');
        
        // BOMの除去
        if (csv.charCodeAt(0) === 0xFEFF) {
            csv = csv.slice(1);
        }
        
        var lines = csv.split(/\r?\n/);
        console.log('行数:', lines.length);
        
        // 空行を除去
        var nonEmptyLines = lines.filter(line => line.trim() !== '');
        console.log('空行を除いた行数:', nonEmptyLines.length);
        
        if (nonEmptyLines.length < 2) {
            console.warn('CSVデータが不正です。ヘッダーとデータ行が必要です。');
            return [];
        }
        
        // 最初の行をヘッダーとして解析
        var firstLine = nonEmptyLines[0];
        // カンマ区切りまたはタブ区切りを検出
        var delimiter = firstLine.includes(',') ? ',' : '\t';
        var headers = firstLine.split(delimiter).map(h => {
            // ヘッダーから余分な引用符やスペースを除去
            return h.trim().replace(/^["']|["']$/g, '');
        });
        console.log('ヘッダー:', headers);
        
        // 文字化けヘッダーの検出（ただし、文字化けしている場合でも処理を続行）
        // 文字化けしている可能性があるが、実際のデータを確認して処理を続行
        // if (this.isCorruptedHeader(headers)) {
        //     console.warn('文字化けしたヘッダーが検出されました。データをスキップします。');
        //     return [];
        // }
        
        // 列のインデックスを明示的に定義（A列: 作業者, B列: 採寸か撮影, C列: 作業日, D列: 商品ID, H列: 作業時間(秒)）
        var assigneeIndex = 0;  // A列
        var categoryIndex = 1;   // B列
        var dateIndex = 2;       // C列
        var countIndex = 7;      // H列
        
        console.log('列のインデックス:', {
            assigneeIndex: assigneeIndex,
            categoryIndex: categoryIndex,
            dateIndex: dateIndex,
            countIndex: countIndex
        });
        
        var data = [];

        for (var i = 1; i < nonEmptyLines.length; i++) {
            var line = nonEmptyLines[i];
            // 空行をスキップ
            if (line.trim() === '') continue;
            
            var values = line.split(delimiter);
            
            // 値の数が十分でない場合はスキップ
            if (values.length < Math.max(assigneeIndex, categoryIndex, dateIndex, countIndex) + 1) {
                console.log(`行${i}は列数が不足のためスキップ:`, values);
                continue;
            }
            
            console.log(`行${i}の値:`, values);
            
            // 各列の値を取得
            var assigneeValue = values[assigneeIndex] ? values[assigneeIndex].trim().replace(/^["']|["']$/g, '') : '';
            var categoryValue = values[categoryIndex] ? values[categoryIndex].trim().replace(/^["']|["']$/g, '') : '';
            var dateValue = values[dateIndex] ? values[dateIndex].trim().replace(/^["']|["']$/g, '') : '';
            var countValue = values[countIndex] ? values[countIndex].trim().replace(/^["']|["']$/g, '') : '';
            
            var row = {
                date: dateValue,
                assignee: assigneeValue,
                category: categoryValue,
                count: countValue
            };
            
            console.log(`行${i}の解析結果:`, row);
            
            // 文字化けデータの検出（条件を緩和）
            // if (this.isCorruptedRow(row)) {
            //     console.log(`行${i}は文字化けデータのためスキップ:`, row);
            //     continue;
            // }
            
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
                        var datePart = row.date.split(' ')[0];
                        // 日付形式の確認と変換
                        if (datePart.includes('/')) {
                            var dateParts = datePart.split('/');
                            if (dateParts.length >= 3) {
                                // YYYY-MM-DD形式に変換
                                var year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                                row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                            }
                        } else {
                            row.date = datePart;
                        }
                    } else if (row.date.includes('/')) {
                        var dateParts = row.date.split('/');
                        if (dateParts.length >= 3) {
                            // YYYY-MM-DD形式に変換
                            var year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                            row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                        }
                    }
                }
                
                // 担当者名のクリーニング
                if (row.assignee) {
                    // 担当者名が極端に短い場合はスキップ
                    if (row.assignee.length < 1) {
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
                var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
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
        var date = document.getElementById('manual-date').value;
        var assignee = document.getElementById('manual-assignee').value;
        var category = document.getElementById('manual-category').value;
        var count = parseInt(document.getElementById('manual-count').value, 10);
        var type = document.getElementById('manual-type').value;

        if (!date || !assignee || !category || !count) {
            this.showNotification('すべてのフィールドを入力してください', 'error');
            return;
        }

        var data = {
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
        var csv = this.generateCSV();
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'sasage_data.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // CSV生成
    generateCSV() {
        var data = this.dataManager.data;
        var csv = 'date,assignee,category,count,type\n';
        
        // 採寸データ
        data.measurements.forEach(function(item) {
            if (item.date && item.assignee && item.category && item.count) {
                csv += item.date + ',' + item.assignee + ',' + item.category + ',' + item.count + ',measurements\n';
            }
        });
        
        // 撮影データ
        data.photos.forEach(function(item) {
            if (item.date && item.assignee && item.category && item.count) {
                csv += item.date + ',' + item.assignee + ',' + item.category + ',' + item.count + ',photos\n';
            }
        });
        
        return csv;
    }

    // データ一覧の読み込み
    loadDataList() {
        var dataList = document.getElementById('data-list');
        if (!dataList) return;

        var dataType = document.getElementById('manage-type').value;
        var data = this.dataManager.data;
        
        // 既存のデータをクリア
        dataList.innerHTML = '';

        // データの結合とソート
        var allData = [];
        
        if (dataType === 'all' || dataType === 'measurements') {
            data.measurements.forEach(function(item) {
                if (item.date && item.assignee && item.category && item.count) {
                    allData.push({ type: '採寸', date: item.date, assignee: item.assignee, category: item.category, count: item.count });
                }
            });
        }
        
        if (dataType === 'all' || dataType === 'photos') {
            data.photos.forEach(function(item) {
                if (item.date && item.assignee && item.category && item.count) {
                    allData.push({ type: '撮影', date: item.date, assignee: item.assignee, category: item.category, count: item.count });
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
        var deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(function(button) {
            button.addEventListener('click', function(e) {
                var index = e.target.dataset.index;
                var type = e.target.dataset.type;
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
        
        // 追加: フォーカスが当たっていない場合でもイベントを確実に送信するため、
        // 100ms後に再度イベントを送信
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('dashboardDataUpdated'));
        }, 100);
        
        console.log('ダッシュボード更新通知を送信しました');
    }

    // 通知の表示
    showNotification(message, type) {
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
        var sasageData = localStorage.getItem('sasageData');
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
            
            // 不正な文字が全体の10%以上含まれている場合のみ文字化けと判定
            return (corruptedCount / text.length) > 0.1;
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

    // 最初のエンコーディングから試す
    // tryEncoding(0);
    // CSV解析
    parseCSV(csv) {
        console.log('CSV解析開始');
        
        // BOMの除去
        if (csv.charCodeAt(0) === 0xFEFF) {
            csv = csv.slice(1);
        }
        
        // UTF-8のBOMをチェックして除去
        if (csv.charCodeAt(0) === 0xEF && csv.charCodeAt(1) === 0xBB && csv.charCodeAt(2) === 0xBF) {
            csv = csv.slice(3);
        }
        
        var lines = csv.split(/\r?\n/);
        console.log('行数:', lines.length);
        
        // 空行を除去
        var nonEmptyLines = lines.filter(line => line.trim() !== '');
        console.log('空行を除いた行数:', nonEmptyLines.length);
        
        if (nonEmptyLines.length < 2) {
            console.warn('CSVデータが不正です。ヘッダーとデータ行が必要です。');
            return [];
        }
        
        // 最初の行をヘッダーとして解析
        var firstLine = nonEmptyLines[0];
        // カンマ区切りまたはタブ区切りを検出
        var delimiter = firstLine.includes(',') ? ',' : '\t';
        var headers = firstLine.split(delimiter).map(h => {
            // ヘッダーから余分な引用符やスペースを除去
            return h.trim().replace(/^["']|["']$/g, '');
        });
        console.log('ヘッダー:', headers);
        
        // 文字化けヘッダーの検出（ただし、文字化けしている場合でも処理を続行）
        // 文字化けしている可能性があるが、実際のデータを確認して処理を続行
        // if (this.isCorruptedHeader(headers)) {
        //     console.warn('文字化けしたヘッダーが検出されました。データをスキップします。');
        //     return [];
        // }
        
        // ヘッダーの文字化け対策 - より強力なパターンマッチング
        var normalizedHeaders = headers.map(header => {
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
        var dateIndex = normalizedHeaders.findIndex(h => h === 'date');
        var assigneeIndex = normalizedHeaders.findIndex(h => h === 'assignee');
        var categoryIndex = normalizedHeaders.findIndex(h => h === 'category');
        var countIndex = normalizedHeaders.findIndex(h => h === 'count');
        
        // 文字化けヘッダーの特別処理
        // インデックスが見つからない場合、列の位置で推定
        if (dateIndex === -1) {
            // 通常、日付は3列目(C列)にある
            if (headers.length > 2) {
                dateIndex = 2;
            }
        }
        
        if (assigneeIndex === -1) {
            // 通常、担当者は1列目(A列)または2列目(B列)にある
            if (headers.length > 0) {
                assigneeIndex = 0;
            } else if (headers.length > 1) {
                assigneeIndex = 1;
            }
        }
        
        if (categoryIndex === -1) {
            // 通常、カテゴリは4列目(D列)にある
            if (headers.length > 3) {
                categoryIndex = 3;
            }
        }
        
        if (countIndex === -1) {
            // 通常、点数は8列目(H列)にある
            if (headers.length > 7) {
                countIndex = 7;
            }
        }
        
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
        
        var data = [];

        for (var i = 1; i < nonEmptyLines.length; i++) {
            var line = nonEmptyLines[i];
            // 空行をスキップ
            if (line.trim() === '') continue;
            
            var values = line.split(delimiter);
            
            // 値の数がヘッダーの数と一致しない場合はスキップ
            if (values.length !== headers.length) {
                console.log(`行${i}は列数が不一致のためスキップ:`, values);
                continue;
            }
            
            console.log(`行${i}の値:`, values);
            
            // 必須フィールドの値を取得
            var dateValue = values[dateIndex] ? values[dateIndex].trim().replace(/^["']|["']$/g, '') : '';
            var assigneeValue = values[assigneeIndex] ? values[assigneeIndex].trim().replace(/^["']|["']$/g, '') : '';
            var categoryValue = values[categoryIndex] ? values[categoryIndex].trim().replace(/^["']|["']$/g, '') : '';
            var countValue = values[countIndex] ? values[countIndex].trim().replace(/^["']|["']$/g, '') : '';
            
            var row = {
                date: dateValue,
                assignee: assigneeValue,
                category: categoryValue,
                count: countValue
            };
            
            console.log(`行${i}の解析結果:`, row);
            
            // 文字化けデータの検出（条件を緩和）
            // if (this.isCorruptedRow(row)) {
            //     console.log(`行${i}は文字化けデータのためスキップ:`, row);
            //     continue;
            // }
            
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
                        var datePart = row.date.split(' ')[0];
                        // 日付形式の確認と変換
                        if (datePart.includes('/')) {
                            var dateParts = datePart.split('/');
                            if (dateParts.length >= 3) {
                                // YYYY-MM-DD形式に変換
                                var year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                                row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                            }
                        } else {
                            row.date = datePart;
                        }
                    } else if (row.date.includes('/')) {
                        var dateParts = row.date.split('/');
                        if (dateParts.length >= 3) {
                            // YYYY-MM-DD形式に変換
                            var year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                            row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                        }
                    }
                }
                
                // 担当者名のクリーニング
                if (row.assignee) {
                    // 担当者名が極端に短い場合はスキップ
                    if (row.assignee.length < 1) {
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
                var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
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
    
    // チャンク処理でCSVを解析
    parseCSVInChunks(csv, dataType, callback) {
        console.log('チャンク処理でCSV解析開始');
        
        // BOMの除去
        if (csv.charCodeAt(0) === 0xFEFF) {
            csv = csv.slice(1);
        }
        
        var lines = csv.split(/\r?\n/);
        console.log('行数:', lines.length);
        
        // 空行を除去
        var nonEmptyLines = lines.filter(line => line.trim() !== '');
        console.log('空行を除いた行数:', nonEmptyLines.length);
        
        if (nonEmptyLines.length < 2) {
            console.warn('CSVデータが不正です。ヘッダーとデータ行が必要です。');
            callback([], 0);
            return;
        }
        
        // 最初の行をヘッダーとして解析
        var firstLine = nonEmptyLines[0];
        // カンマ区切りまたはタブ区切りを検出
        var delimiter = firstLine.includes(',') ? ',' : '\t';
        var headers = firstLine.split(delimiter).map(h => {
            // ヘッダーから余分な引用符やスペースを除去
            return h.trim().replace(/^["']|["']$/g, '');
        });
        console.log('ヘッダー:', headers);
        
        // 文字化けヘッダーの検出を改善
        // 文字化けしている可能性があるが、実際のデータを確認して処理を続行
        // if (this.isCorruptedHeader(headers)) {
        //     console.warn('文字化けしたヘッダーが検出されました。データをスキップします。');
        //     callback([], 0);
        //     return;
        // }
        
        // ヘッダーの文字化け対策 - より強力なパターンマッチング
        var normalizedHeaders = headers.map(header => {
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
        var dateIndex = normalizedHeaders.findIndex(h => h === 'date');
        var assigneeIndex = normalizedHeaders.findIndex(h => h === 'assignee');
        var categoryIndex = normalizedHeaders.findIndex(h => h === 'category');
        var countIndex = normalizedHeaders.findIndex(h => h === 'count');
        
        if (dateIndex === -1 || assigneeIndex === -1 || categoryIndex === -1 || countIndex === -1) {
            console.warn('必須フィールドが不足しています');
            callback([], 0);
            return;
        }
        
        // チャンクサイズと現在のインデックス
        var chunkSize = 5000; // 1回の処理で5000行（処理速度向上のため増加）
        var currentIndex = 1; // ヘッダー行をスキップ
        var successCount = 0;
        var processedData = [];
        
        // プログレスバーの更新間隔
        var progressUpdateInterval = 1000; // 1000行ごとにプログレスバーを更新
        var lastProgressUpdate = 0;
        
        // プログレスバーの更新
        this.updateProgress(0, nonEmptyLines.length - 1);
        
        // チャンク処理の関数
        var processChunk = () => {
            var endIndex = Math.min(currentIndex + chunkSize, nonEmptyLines.length);
            
            for (var i = currentIndex; i < endIndex; i++) {
                var line = nonEmptyLines[i];
                // 空行をスキップ
                if (line.trim() === '') continue;
                
                var values = line.split(delimiter);
                
                // 値の数がヘッダーの数と一致しない場合はスキップ
                if (values.length !== headers.length) {
                    continue;
                }
                
                // 必須フィールドの値を取得
                var dateValue = values[dateIndex] ? values[dateIndex].trim().replace(/^["']|["']$/g, '') : '';
                var assigneeValue = values[assigneeIndex] ? values[assigneeIndex].trim().replace(/^["']|["']$/g, '') : '';
                var categoryValue = values[categoryIndex] ? values[categoryIndex].trim().replace(/^["']|["']$/g, '') : '';
                var countValue = values[countIndex] ? values[countIndex].trim().replace(/^["']|["']$/g, '') : '';
                
                // 必須フィールドの検証（ログ出力を削減）
                if (!dateValue || !assigneeValue || !categoryValue || !countValue) {
                    continue;
                }
                
                var row = {
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
                    var dateParts = row.date.split('/');
                    if (dateParts.length >= 3) {
                        var year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                        row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                    }
                }
                
                if (row.date.includes('-')) {
                    var dateParts = row.date.split('-');
                    if (dateParts.length >= 3) {
                        var year = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0]}`;
                        row.date = `${year}-${dateParts[1].padStart(2, '0')}-${dateParts[2].padStart(2, '0')}`;
                    }
                }
                
                // 日付形式の最終確認
                var dateRegex = /^\d{4}-\d{2}-\d{2}$/;
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
                if (validData.valid.length > 0) {
                    // データを保存
                    if (dataType === 'measurements') {
                        this.dataManager.addMeasurement(validData.valid);
                    } else {
                        this.dataManager.addPhoto(validData.valid);
                    }
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
                    var saveResult = this.dataManager.saveData();
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

    // 商品データアップロード処理
    uploadProductData() {
        const fileInput = document.getElementById('csv-file');
        const dataType = document.getElementById('data-type').value;

        // 商品データアップロードの場合は特別な処理を行う
        if (dataType === 'productData') {
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

            this.uploadProductDataFile(file);
            return;
        }

        // 既存の処理（採寸データまたは撮影データ）を実行
        this.uploadCSV();
    }

    // 商品データCSVファイルのアップロード処理
    uploadProductDataFile(file) {
        console.log('商品データCSVファイルアップロード開始:', file.name);
        
        // プログレスバーの表示
        this.showProgress(true);
        
        // 複数のエンコーディングで試す
        const encodings = ['Shift_JIS', 'UTF-8', 'UTF-16'];
        
        // エンコーディング検出を試みる
        const detectEncoding = (arrayBuffer) => {
            // バイト配列の先頭バイトをチェック
            const bytes = new Uint8Array(arrayBuffer.slice(0, 100)); // 最初の100バイトをチェック
            
            // BOMのチェック
            if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
                return 'UTF-16LE';
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
            
            // Shift-JISスコアがUTF-8スコアより高い場合はShift-JISを返す
            // ただし、スコアが低い場合でもShift-JISを優先的に試す
            if (shiftJisScore > 0 || utf8Score === 0) {
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
                    // Shift-JISのデコードを試みる（エラーを許容）
                    const decoder = new TextDecoder('shift-jis', { fatal: false });
                    const result = decoder.decode(arrayBuffer);
                    
                    // デコード結果をチェック
                    if (result && result.length > 0) {
                        // 文字化けの程度をチェック
                        const corruptedChars = (result.match(/[]/g) || []).length;
                        const totalChars = result.length;
                        
                        // 文字化け率が50%未満であれば採用
                        if (corruptedChars / totalChars < 0.5) {
                            return result;
                        }
                    }
                    
                    // デコード結果が不十分な場合はUTF-8で再試行
                    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
                    return utf8Decoder.decode(arrayBuffer);
                } catch (e) {
                    console.error('Shift-JISデコードエラー:', e);
                    // フォールバックとしてUTF-8でデコードを試みる
                    try {
                        const decoder = new TextDecoder('utf-8', { fatal: false });
                        return decoder.decode(arrayBuffer);
                    } catch (e2) {
                        console.error('UTF-8デコードエラー:', e2);
                        // 最後の手段として、バイナリ文字列に変換
                        let binary = '';
                        const bytes = new Uint8Array(arrayBuffer);
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        return binary;
            if (shiftJisScore > 0 || utf8Score === 0) {
                return 'Shift_JIS';
            }
            
            // デフォルトはUTF-8
            return 'UTF-8';
        };
        
        // Shift-JISデコーダーの作成（テキストエンコーディングAPIを使用）
        var decodeShiftJIS = function(arrayBuffer) {
            // ブラウザがTextDecoderをサポートしているかチェック
            if (typeof TextDecoder !== 'undefined') {
                try {
                    // Shift-JISのデコードを試みる（エラーを許容）
                    const decoder = new TextDecoder('shift-jis', { fatal: false });
                    const result = decoder.decode(arrayBuffer);
                    
                    // デコード結果をチェック
                    if (result && result.length > 0) {
                        // 文字化けの程度をチェック
                        const corruptedChars = (result.match(/[]/g) || []).length;
                        const totalChars = result.length;
                        
                        // 文字化け率が50%未満であれば採用
                        if (corruptedChars / totalChars < 0.5) {
                            return result;
                        }
                    }
                    
                    // デコード結果が不十分な場合はUTF-8で再試行
                    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
                    return utf8Decoder.decode(arrayBuffer);
                } catch (e) {
                    console.error('Shift-JISデコードエラー:', e);
                    // フォールバックとしてUTF-8でデコードを試みる
                    try {
                        const decoder = new TextDecoder('utf-8', { fatal: false });
                        return decoder.decode(arrayBuffer);
                    } catch (e2) {
                        console.error('UTF-8デコードエラー:', e2);
                        // 最後の手段として、バイナリ文字列に変換
                        let binary = '';
                        const bytes = new Uint8Array(arrayBuffer);
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        return binary;
                    }
                }
            } else {
                // TextDecoderがサポートされていない場合は、UTF-8でデコードを試みる
                try {
                    const decoder = new TextDecoder('utf-8', { fatal: false });
                    return decoder.decode(arrayBuffer);
                } catch (e) {
                    console.error('UTF-8デコードエラー:', e);
                    // 最後の手段として、バイナリ文字列に変換
                    let binary = '';
                    const bytes = new Uint8Array(arrayBuffer);
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    return binary;
                }
            }
        };
        
        var tryEncoding = function(index) {
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
                    console.log(`${encoding}で読み込み成功`);  // この行でどのエンコーディングで読み込みが成功したかを出力
                    
                    // BOMの除去
                    if (csv.charCodeAt(0) === 0xFEFF) {
                        csv = csv.slice(1);
                    }
                    
                    // CSVを解析
                    const productData = this.dataManager.parseProductCSV(csv);
                    
                    // データが取得できなかった場合、次のエンコーディングを試す
                    if (productData.length === 0) {
                        // 文字化けの可能性があるため、次のエンコーディングを試す
                        console.log(`${encoding}では有効なデータを取得できませんでした`);
                        tryEncoding(index + 1);
                        return;
                    }
                    
                    // データをDataManagerに追加
                    let successCount = 0;
                    productData.forEach(data => {
                        // 新しいデータ形式に合わせて変換
                        const convertedData = {
                            id: Date.now() + Math.random(), // IDを生成
                            assignee: data.assignee,
                            category: data.type, // 採寸か撮影をカテゴリとして使用
                            date: data.date,
                            count: 1, // 各行が1件のデータとして扱う
                            productId: data.productId,
                            workTime: data.workTime,
                            workDuration: data.workDuration
                        };
                        
                        // 採寸または撮影データとして追加
                        if (data.type === '採寸') {
                            this.dataManager.addMeasurement(convertedData);
                        } else if (data.type === '撮影') {
                            this.dataManager.addPhoto(convertedData);
                        }
                        
                        successCount++;
                    });
                    
                    // データを保存
                    const saveResult = this.dataManager.saveData();
                    console.log('データ保存結果:', saveResult);
                    
                    // アップロード完了メッセージ
                    this.showNotification(`🎉 アップロード完了！ ${successCount}件の商品データを正常に追加しました`, 'success');
                    this.loadDataList();
                    this.showProgress(false);
                    
                    // ダッシュボードにデータ反映を通知
                    console.log('ダッシュボード更新通知開始');
                    this.notifyDashboardUpdate();
                    console.log('ダッシュボード更新通知完了');
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
                                
                                // CSVを解析
                                const productData = this.dataManager.parseProductCSV(cleanCsv);
                                
                                // データが取得できなかった場合、次のエンコーディングを試す
                                if (productData.length === 0) {
                                    // 文字化けの可能性があるため、次のエンコーディングを試す
                                    console.log(`${detectedEncoding}では有効なデータを取得できませんでした`);
                                    tryEncoding(index + 1);
                                    return;
                                }
                                
                                // データをDataManagerに追加
                                let successCount = 0;
                                productData.forEach(data => {
                                    // 新しいデータ形式に合わせて変換
                                    const convertedData = {
                                        id: Date.now() + Math.random(), // IDを生成
                                        assignee: data.assignee,
                                        category: data.type, // 採寸か撮影をカテゴリとして使用
                                        date: data.date,
                                        count: 1, // 各行が1件のデータとして扱う
                                        productId: data.productId,
                                        workTime: data.workTime,
                                        workDuration: data.workDuration
                                    };
                                    
                                    // 採寸または撮影データとして追加
                                    if (data.type === '採寸') {
                                        this.dataManager.addMeasurement(convertedData);
                                    } else if (data.type === '撮影') {
                                        this.dataManager.addPhoto(convertedData);
                                    }
                                    
                                    successCount++;
                                });
                                
                                // データを保存
                                const saveResult = this.dataManager.saveData();
                                console.log('データ保存結果:', saveResult);
                                
                                // アップロード完了メッセージ
                                this.showNotification(`🎉 アップロード完了！ ${successCount}件の商品データを正常に追加しました`, 'success');
                                this.loadDataList();
                                this.showProgress(false);
                                
                                // ダッシュボードにデータ反映を通知
                                console.log('ダッシュボード更新通知開始');
                                this.notifyDashboardUpdate();
                                console.log('ダッシュボード更新通知完了');
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
                                
                                // CSVを解析
                                const productData = this.dataManager.parseProductCSV(csv);
                                
                                // データが取得できなかった場合、次のエンコーディングを試す
                                if (productData.length === 0) {
                                    // 文字化けの可能性があるため、次のエンコーディングを試す
                                    console.log(`${detectedEncoding}では有効なデータを取得できませんでした`);
                                    tryEncoding(index + 1);
                                    return;
                                }
                                
                                // データをDataManagerに追加
                                let successCount = 0;
                                productData.forEach(data => {
                                    // 新しいデータ形式に合わせて変換
                                    const convertedData = {
                                        id: Date.now() + Math.random(), // IDを生成
                                        assignee: data.assignee,
                                        category: data.type, // 採寸か撮影をカテゴリとして使用
                                        date: data.date,
                                        count: 1, // 各行が1件のデータとして扱う
                                        productId: data.productId,
                                        workTime: data.workTime,
                                        workDuration: data.workDuration
                                    };
                                    
                                    // 採寸または撮影データとして追加
                                    if (data.type === '採寸') {
                                        this.dataManager.addMeasurement(convertedData);
                                    } else if (data.type === '撮影') {
                                        this.dataManager.addPhoto(convertedData);
                                    }
                                    
                                    successCount++;
                                });
                                
                                // データを保存
                                const saveResult = this.dataManager.saveData();
                                console.log('データ保存結果:', saveResult);
                                
                                // アップロード完了メッセージ
                                this.showNotification(`🎉 アップロード完了！ ${successCount}件の商品データを正常に追加しました`, 'success');
                                this.loadDataList();
                                this.showProgress(false);
                                
                                // ダッシュボードにデータ反映を通知
                                console.log('ダッシュボード更新通知開始');
                                this.notifyDashboardUpdate();
                                console.log('ダッシュボード更新通知完了');
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
    };
    
    // 商品データ分析機能
    AdminPage.prototype.runProductAnalysis = function() {
        const analysisType = document.getElementById('analysis-type').value;
        const productData = this.dataManager.getProductData();
        
        if (productData.length === 0) {
            this.showNotification('分析するデータがありません', 'error');
            return;
        }
        
        let resultHTML = '';
        
        switch (analysisType) {
            case 'work-efficiency':
                resultHTML = this.analyzeWorkEfficiency(productData);
                break;
            case 'item-distribution':
                resultHTML = this.analyzeItemDistribution(productData);
                break;
            case 'brand-analysis':
                resultHTML = this.analyzeBrandData(productData);
                break;
            case 'condition-analysis':
                resultHTML = this.analyzeConditionData(productData);
                break;
            default:
                resultHTML = '<p>未知の分析タイプです</p>';
        }
        
        document.getElementById('analysis-results').innerHTML = resultHTML;
    }
    
    // 作業効率分析
    AdminPage.prototype.analyzeWorkEfficiency = function(productData) {
        // 作業時間と撮影時間の平均を計算
        var totalWorkDuration = 0;
        var totalPhotoDuration = 0;
        var workCount = 0;
        var photoCount = 0;
        
        productData.forEach(function(item) {
            if (item.workDuration) {
                totalWorkDuration += item.workDuration;
                workCount++;
            }
            if (item.photoDuration) {
                totalPhotoDuration += item.photoDuration;
                photoCount++;
            }
        });
        
        var avgWorkDuration = workCount > 0 ? (totalWorkDuration / workCount).toFixed(2) : 0;
        var avgPhotoDuration = photoCount > 0 ? (totalPhotoDuration / photoCount).toFixed(2) : 0;
        
        return '<h3>作業効率分析結果</h3><div class="analysis-result"><p><strong>平均データ入力時間:</strong> ' + avgWorkDuration + ' 分</p><p><strong>平均撮影時間:</strong> ' + avgPhotoDuration + ' 分</p><p><strong>総データ数:</strong> ' + productData.length + ' 件</p></div>';
    }
    
    // アイテム分布分析
    AdminPage.prototype.analyzeItemDistribution = function(productData) {
        // アイテムカテゴリ別の分布を計算
        var itemDistribution = {};
        
        productData.forEach(function(item) {
            var category = item.itemCategory || '未分類';
            itemDistribution[category] = (itemDistribution[category] || 0) + 1;
        });
        
        // 上位5つのカテゴリを取得
        var sortedCategories = Object.entries(itemDistribution)
            .sort(function(a, b) { return b[1] - a[1]; })
            .slice(0, 5);
        
        var distributionHTML = '<h3>アイテム分布（上位5）</h3><ul>';
        sortedCategories.forEach(function(categoryCount) {
            var category = categoryCount[0];
            var count = categoryCount[1];
            distributionHTML += '<li>' + category + ': ' + count + ' 件</li>';
        });
        distributionHTML += '</ul>';
        
        return distributionHTML;
    }
    
    // ブランド分析
    AdminPage.prototype.analyzeBrandData = function(productData) {
        // ブランド別の分布を計算
        var brandDistribution = {};
        
        productData.forEach(function(item) {
            var brand = item.brand || '未分類';
            brandDistribution[brand] = (brandDistribution[brand] || 0) + 1;
        });
        
        // 上位5つのブランドを取得
        var sortedBrands = Object.entries(brandDistribution)
            .sort(function(a, b) { return b[1] - a[1]; })
            .slice(0, 5);
        
        var brandHTML = '<h3>ブランド分析（上位5）</h3><ul>';
        sortedBrands.forEach(function(brandCount) {
            var brand = brandCount[0];
            var count = brandCount[1];
            brandHTML += '<li>' + brand + ': ' + count + ' 件</li>';
        });
        brandHTML += '</ul>';
        
        return brandHTML;
    }
    
    // 状態分析
    AdminPage.prototype.analyzeConditionData = function(productData) {
        // ランク別の分布を計算
        var rankDistribution = {};
        
        productData.forEach(function(item) {
            var rank = item.rank || '未分類';
            rankDistribution[rank] = (rankDistribution[rank] || 0) + 1;
        });
        
        var rankHTML = '<h3>状態ランク分布</h3><ul>';
        Object.entries(rankDistribution).forEach(function(rankCount) {
            var rank = rankCount[0];
            var count = rankCount[1];
            rankHTML += '<li>ランク ' + rank + ': ' + count + ' 件</li>';
        });
        rankHTML += '</ul>';
        
        return rankHTML;
    };
}

// ページ読み込み完了時にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', function() {
    window.adminPage = new AdminPage();
