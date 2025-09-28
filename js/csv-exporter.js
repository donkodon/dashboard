// CSVエクスポータークラス

class CSVExporter {
    constructor() {
        this.dataManager = new DataManager();
    }

    // データをCSV形式に変換
    convertToCSV(data, headers) {
        if (!data || data.length === 0) {
            return '';
        }

        // ヘッダー行の作成
        const headerRow = headers.map(header => this.escapeCSVField(header)).join(',');
        
        // データ行の作成
        const dataRows = data.map(row => {
            return headers.map(header => {
                const value = row[header];
                return this.escapeCSVField(value !== undefined ? value : '');
            }).join(',');
        }).join('\n');
        
        return `${headerRow}\n${dataRows}`;
    }

    // CSVフィールドのエスケープ処理
    escapeCSVField(field) {
        // 文字列に変換
        const str = String(field);
        
        // カンマ、ダブルクォート、改行が含まれている場合、ダブルクォートで囲み、
        // ダブルクォートはエスケープする
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        
        return str;
    }

    // 日付範囲フィルターを適用したデータのエクスポート
    async exportFilteredData(filters = {}) {
        try {
            const filteredData = this.dataManager.getFilteredData(filters);
            
            // 採寸データと撮影データを結合
            const allData = [
                ...filteredData.measurements.map(item => ({
                    ...item,
                    type: '採寸'
                })),
                ...filteredData.photos.map(item => ({
                    ...item,
                    type: '撮影'
                }))
            ];
            
            // データを日付でソート
            allData.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // ヘッダー定義
            const headers = ['date', 'assignee', 'category', 'count', 'type'];
            const headerLabels = ['日付', '担当者', 'カテゴリ', '点数', 'タイプ'];
            
            // CSVデータの生成
            const csvData = this.convertToCSV(allData, headers);
            const csvWithHeaderLabels = `${headerLabels.join(',')}\n${csvData.split('\n').slice(1).join('\n')}`;
            
            return csvWithHeaderLabels;
        } catch (error) {
            console.error('フィルター済みデータのエクスポートエラー:', error);
            throw error;
        }
    }

    // 月別集計データのエクスポート
    async exportMonthlySummary(filters = {}) {
        try {
            const monthlyData = this.dataManager.getMonthlySummary(filters);
            
            // データを整形
            const exportData = monthlyData.months.map((month, index) => ({
                month: month,
                measurements: monthlyData.measurements[index],
                photos: monthlyData.photos[index]
            }));
            
            // ヘッダー定義
            const headers = ['month', 'measurements', 'photos'];
            const headerLabels = ['月', '採寸点数', '撮影点数'];
            
            // CSVデータの生成
            const csvData = this.convertToCSV(exportData, headers);
            const csvWithHeaderLabels = `${headerLabels.join(',')}\n${csvData.split('\n').slice(1).join('\n')}`;
            
            return csvWithHeaderLabels;
        } catch (error) {
            console.error('月別集計データのエクスポートエラー:', error);
            throw error;
        }
    }

    // 担当者別集計データのエクスポート
    async exportAssigneeSummary(filters = {}) {
        try {
            const assigneeData = this.dataManager.getAssigneeSummary(filters);
            
            // ヘッダー定義
            const headers = ['assignee', 'measurements', 'photos', 'completionRate'];
            const headerLabels = ['担当者', '採寸点数', '撮影点数', '完了率(%)'];
            
            // CSVデータの生成
            const csvData = this.convertToCSV(assigneeData, headers);
            const csvWithHeaderLabels = `${headerLabels.join(',')}\n${csvData.split('\n').slice(1).join('\n')}`;
            
            return csvWithHeaderLabels;
        } catch (error) {
            console.error('担当者別集計データのエクスポートエラー:', error);
            throw error;
        }
    }

    // カテゴリ別集計データのエクスポート
    async exportCategorySummary(filters = {}) {
        try {
            const categoryData = this.dataManager.getCategorySummary(filters);
            
            // ヘッダー定義
            const headers = ['category', 'measurements', 'photos', 'completionRate'];
            const headerLabels = ['カテゴリ', '採寸点数', '撮影点数', '完了率(%)'];
            
            // CSVデータの生成
            const csvData = this.convertToCSV(categoryData, headers);
            const csvWithHeaderLabels = `${headerLabels.join(',')}\n${csvData.split('\n').slice(1).join('\n')}`;
            
            return csvWithHeaderLabels;
        } catch (error) {
            console.error('カテゴリ別集計データのエクスポートエラー:', error);
            throw error;
        }
    }

    // CSVファイルのダウンロード
    downloadCSV(csvData, filename) {
        const blob = new Blob(['\ufeff', csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // データスキーマの取得
    getDataSchema() {
        return {
            measurements: {
                fields: ['id', 'date', 'assignee', 'category', 'count'],
                labels: ['ID', '日付', '担当者', 'カテゴリ', '点数']
            },
            photos: {
                fields: ['id', 'date', 'assignee', 'category', 'count'],
                labels: ['ID', '日付', '担当者', 'カテゴリ', '点数']
            }
        };
    }

    // サンプルCSVの生成
    generateSampleCSV() {
        const sampleData = [
            { date: '2023-01-01', assignee: '田中', category: 'トップス', count: 10 },
            { date: '2023-01-01', assignee: '佐藤', category: 'ボトムス', count: 8 },
            { date: '2023-01-02', assignee: '鈴木', category: 'アウター', count: 12 }
        ];
        
        const headers = ['date', 'assignee', 'category', 'count'];
        const headerLabels = ['日付', '担当者', 'カテゴリ', '点数'];
        
        const csvData = this.convertToCSV(sampleData, headers);
        const csvWithHeaderLabels = `${headerLabels.join(',')}\n${csvData.split('\n').slice(1).join('\n')}`;
        
        return csvWithHeaderLabels;
    }
}

// グローバルインスタンスの作成
const csvExporter = new CSVExporter();