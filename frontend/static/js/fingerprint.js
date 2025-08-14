class BrowserFingerprint {
    static async generate() {
        const fingerprint = {};
        
        // 基本信息
        fingerprint.user_agent = navigator.userAgent;
        fingerprint.language = navigator.language;
        fingerprint.platform = navigator.platform;
        fingerprint.screen_resolution = `${screen.width}x${screen.height}`;
        fingerprint.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // 插件信息
        fingerprint.plugins = Array.from(navigator.plugins)
            .map(plugin => plugin.name)
            .sort()
            .join(',');
        
        // Canvas指纹
        fingerprint.canvas_fingerprint = this.getCanvasFingerprint();
        
        // WebGL指纹
        fingerprint.webgl_fingerprint = this.getWebGLFingerprint();
        
        return fingerprint;
    }
    
    static getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 绘制一些图形和文字
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('AppHub Fingerprint 🌟', 2, 2);
            
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillRect(100, 5, 80, 20);
            
            ctx.fillStyle = '#f60';
            ctx.fillRect(10, 25, 100, 20);
            
            const dataURL = canvas.toDataURL();
            
            // 生成哈希
            return this.simpleHash(dataURL);
        } catch (e) {
            return 'canvas_not_supported';
        }
    }
    
    static getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                return 'webgl_not_supported';
            }
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            
            return this.simpleHash(`${vendor}|${renderer}`);
        } catch (e) {
            return 'webgl_not_supported';
        }
    }
    
    static simpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        
        return Math.abs(hash).toString(16);
    }
    
    static async register() {
        try {
            const fingerprint = await this.generate();
            
            const response = await fetch('/api/fingerprint', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fingerprint),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                // 存储用户信息到本地存储
                localStorage.setItem('apphub_user_id', data.user_id);
                localStorage.setItem('apphub_fingerprint', data.fingerprint);
                
                return data;
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('指纹注册失败:', error);
            throw error;
        }
    }
    
    static getUserId() {
        return localStorage.getItem('apphub_user_id');
    }
    
    static getFingerprint() {
        return localStorage.getItem('apphub_fingerprint');
    }
}