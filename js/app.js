// ダッシュボードアプリケーションのメインJavaScriptファイル

class SasageDashboard {
    constructor() {
        this.dataManager = new DataManager();
        this.monthlyChart = null;
        this.dailyChart = null;
        this.init();
    }

    async init() {
        await this.dataManager.initialize();
        this.initializeCharts();
        this.bindEvents();
        this.loadData();
        this.setupDataUpdateListener();
    }

    // チャートの初期化
    initializeCharts() {
        // 月別チャート
        const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
        this.monthlyChart = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
                datasets: [
                    {
                        label: '採寸点数',
                        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(102, 126, 234, 0.7)',
                        borderColor: 'rgba(102, 126, 234, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '撮影点数',
                        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: 'rgba(118, 75, 162, 0.7)',
                        borderColor: 'rgba(118, 75, 162, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });

        // 日別チャート
        const dailyCtx = document.getElementById('dailyChart').getContext('2d');
        this.dailyChart = new Chart(dailyCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: '採寸点数',
                        data: [],
                        borderColor: 'rgba(102, 126, 234, 1)',
                        backgroundColor: 'rgba(102, 126, 234, 0.2)',
                        tension: 0.1,
                        fill: true
                    },
                    {
                        label: '撮影点数',
                        data: [],
                        borderColor: 'rgba(118, 75, 162, 1)',
                        backgroundColor: 'rgba(118, 75, 162, 0.2)',
                        tension: 0.1,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // イベントバインディング
    bindEvents() {
        const applyFiltersBtn = document.getElementById('apply-filters');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.applyFilters();
            });
        }

        // 日付フィールドの変更イベント
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        
        if (startDateInput) {
            startDateInput.addEventListener('change', () => {
                this.validateDateRange();
            });
        }
        
        if (endDateInput) {
            endDateInput.addEventListener('change', () => {
                this.validateDateRange();
            });
        }
    }

    // データ更新リスナーの設定
    setupDataUpdateListener() {
        // ローカルストレージの変更を監視
        const checkForUpdates = () => {
            const lastUpdate = localStorage.getItem('dashboardDataUpdated');
            if (lastUpdate) {
                const lastUpdateTime = parseInt(lastUpdate, 10);
                const currentTime = Date.now();
                
                // 10秒以内の更新のみ反映（時間を延長）
                if (currentTime - lastUpdateTime < 10000) {
                    this.loadData();
                    // 処理後、タイムスタンプをクリアして重複処理を防ぐ
                    localStorage.removeItem('dashboardDataUpdated');
                }
            }
        };

        // 1秒ごとにチェック
        setInterval(checkForUpdates, 1000);

        // カスタムイベントを監視
        window.addEventListener('dashboardDataUpdated', () => {
            console.log('ダッシュボード更新イベントを受信');
            this.loadData();
        });
    }

    // フィルターの適用
    applyFilters() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const assignee = document.getElementById('assignee').value;
        const category = document.getElementById('category').value;

        console.log('フィルター適用:', { startDate, endDate, assignee, category });

        // 実際のアプリケーションでは、ここでAPIを呼び出してデータを取得し、
        // チャートとテーブルを更新します
        this.showNotification('フィルターを適用しました', 'success');
    }

    // 日付範囲の検証
    validateDateRange() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            this.showNotification('開始日は終了日より前である必要があります', 'error');
            return false;
        }
        return true;
    }

    // データの読み込み
    async loadData() {
        try {
            console.log('データ読み込み開始');
            // データマネージャーから最新データを取得
            await this.dataManager.initialize();
            console.log('データマネージャー初期化完了:', this.dataManager.data);
            
            // 実際のデータでダッシュボードを更新
            const summary = this.dataManager.getSummary();
            const monthlyData = this.dataManager.getMonthlySummary();
            const dailyData = this.dataManager.getDailySummary();
            const assigneeData = this.dataManager.getAssigneeSummary();
            const categoryData = this.dataManager.getCategorySummary();
            
            console.log('集計データ:', { summary, monthlyData, dailyData, assigneeData, categoryData });
            
            this.updateDashboard({
                summary,
                monthlyData,
                dailyData,
                assigneeData,
                categoryData
            });
            
            console.log('ダッシュボード更新完了');
        } catch (error) {
            console.error('データの読み込みに失敗しました:', error);
            // エラー時にもデフォルトデータで更新
            this.updateDashboard(this.getDefaultData());
        }
    }

    // デフォルトデータの取得
    getDefaultData() {
        return {
            summary: {
                measurements: 0,
                photos: 0,
                completionRate: 0
            },
            monthlyData: {
                months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
                measurements: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                photos: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            },
            dailyData: {
                days: [],
                measurements: [],
                photos: []
            },
            assigneeData: [],
            categoryData: []
        };
    }

    // ダッシュボードの更新
    updateDashboard(data) {
        // サマリーデータの更新
        if (data.summary) {
            document.querySelector('.summary-cards .card:nth-child(1) .count').textContent = 
                data.summary.measurements.toLocaleString();
            document.querySelector('.summary-cards .card:nth-child(2) .count').textContent = 
                data.summary.photos.toLocaleString();
            document.querySelector('.summary-cards .card:nth-child(3) .count').textContent = 
                `${data.summary.completionRate}%`;
        }

        // チャートデータの更新
        if (data.monthlyData && this.monthlyChart) {
            this.monthlyChart.data.labels = data.monthlyData.months;
            this.monthlyChart.data.datasets[0].data = data.monthlyData.measurements;
            this.monthlyChart.data.datasets[1].data = data.monthlyData.photos;
            this.monthlyChart.update();
        }

        if (data.dailyData && this.dailyChart) {
            this.dailyChart.data.labels = data.dailyData.days;
            this.dailyChart.data.datasets[0].data = data.dailyData.measurements;
            this.dailyChart.data.datasets[1].data = data.dailyData.photos;
            this.dailyChart.update();
        }

        // 担当者別テーブルの更新
        if (data.assigneeData) {
            const assigneeTableBody = document.getElementById('assignee-table-body');
            if (assigneeTableBody) {
                assigneeTableBody.innerHTML = '';
                data.assigneeData.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.assignee}</td>
                        <td>${item.measurements}</td>
                        <td>${item.photos}</td>
                        <td>${item.completionRate}%</td>
                    `;
                    assigneeTableBody.appendChild(row);
                });
            }
        }

        // カテゴリ別テーブルの更新
        if (data.categoryData) {
            const categoryTableBody = document.getElementById('category-table-body');
            if (categoryTableBody) {
                categoryTableBody.innerHTML = '';
                data.categoryData.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.category}</td>
                        <td>${item.measurements}</td>
                        <td>${item.photos}</td>
                        <td>${item.completionRate}%</td>
                    `;
                    categoryTableBody.appendChild(row);
                });
            }
        }
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
        alert.textContent = message;

        // ダッシュボードの先頭に通知を追加
        const dashboardContainer = document.querySelector('.dashboard-container');
        dashboardContainer.insertBefore(alert, dashboardContainer.firstChild);

        // 3秒後に通知を削除
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 3000);
    }
}

// ページ読み込み完了時にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
    window.sasageDashboard = new SasageDashboard();
});