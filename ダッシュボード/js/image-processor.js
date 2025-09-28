// 画像処理クラス

class ImageProcessor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
    }

    // キャンバスの初期化
    initCanvas() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
        }
    }

    // 画像の読み込み
    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    // 画像のリサイズ
    async resizeImage(image, maxWidth, maxHeight) {
        this.initCanvas();
        
        let { width, height } = image;
        
        // アスペクト比を維持しながらリサイズ
        if (width > height) {
            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.drawImage(image, 0, 0, width, height);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    // 画像のトリミング
    async cropImage(image, x, y, width, height) {
        this.initCanvas();
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    // 画像の回転
    async rotateImage(image, angle) {
        this.initCanvas();
        
        const width = image.width;
        const height = image.height;
        
        // 回転後のキャンバスサイズを計算
        const radians = angle * Math.PI / 180;
        const sine = Math.abs(Math.sin(radians));
        const cosine = Math.abs(Math.cos(radians));
        const newWidth = width * cosine + height * sine;
        const newHeight = width * sine + height * cosine;
        
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        
        // 回転の中心を設定
        this.ctx.translate(newWidth / 2, newHeight / 2);
        this.ctx.rotate(radians);
        
        // 画像を描画
        this.ctx.drawImage(image, -width / 2, -height / 2);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    // 背景除去（簡易版 - グレースケール変換）
    async removeBackground(image) {
        this.initCanvas();
        
        const width = image.width;
        const height = image.height;
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.ctx.drawImage(image, 0, 0);
        
        const imageData = this.ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // グレースケール変換
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // 明るさを計算
            const brightness = (r + g + b) / 3;
            
            // 明るさに基づいてアルファ値を設定（簡易背景除去）
            if (brightness > 200) {
                data[i + 3] = 0; // 背景を透明にする
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
        
        return this.canvas.toDataURL('image/png');
    }

    // 画像にテキストを追加
    async addTextToImage(image, text, x, y, options = {}) {
        this.initCanvas();
        
        const {
            fontSize = 20,
            fontFamily = 'Arial',
            color = 'white',
            backgroundColor = 'rgba(0, 0, 0, 0.5)',
            padding = 10
        } = options;
        
        this.canvas.width = image.width;
        this.canvas.height = image.height;
        
        // 元の画像を描画
        this.ctx.drawImage(image, 0, 0);
        
        // テキストの背景を描画
        this.ctx.font = `${fontSize}px ${fontFamily}`;
        const textWidth = this.ctx.measureText(text).width;
        const textHeight = fontSize;
        
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(
            x - padding, 
            y - textHeight - padding, 
            textWidth + padding * 2, 
            textHeight + padding * 2
        );
        
        // テキストを描画
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
        
        return this.canvas.toDataURL('image/jpeg', 0.8);
    }

    // 画像をBlobに変換
    dataURLToBlob(dataURL) {
        const parts = dataURL.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        
        return new Blob([uInt8Array], { type: contentType });
    }

    // 画像処理パイプライン
    async processImage(imageSrc, operations) {
        try {
            let image = await this.loadImage(imageSrc);
            
            for (const operation of operations) {
                switch (operation.type) {
                    case 'resize':
                        image = await this.resizeImage(
                            image, 
                            operation.maxWidth, 
                            operation.maxHeight
                        );
                        break;
                    case 'crop':
                        image = await this.cropImage(
                            image,
                            operation.x,
                            operation.y,
                            operation.width,
                            operation.height
                        );
                        break;
                    case 'rotate':
                        image = await this.rotateImage(
                            image,
                            operation.angle
                        );
                        break;
                    case 'removeBackground':
                        image = await this.removeBackground(image);
                        break;
                    case 'addText':
                        image = await this.addTextToImage(
                            image,
                            operation.text,
                            operation.x,
                            operation.y,
                            operation.options
                        );
                        break;
                }
            }
            
            return image;
        } catch (error) {
            console.error('画像処理エラー:', error);
            throw error;
        }
    }
}

// グローバルインスタンスの作成
const imageProcessor = new ImageProcessor();