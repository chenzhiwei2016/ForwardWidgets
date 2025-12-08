WidgetMetadata = {
    id: "youtube_playlist_widget_v2",
    title: "YouTube Playlist Fetcher",
    description: "动态获取 YouTube API Key 并抓取播放列表",
    author: "Your Name",
    site: "https://github.com/yourusername",
    version: "1.1.0",
    requiredVersion: "0.0.1",
    detailCacheDuration: 3600,
    modules: [
        {
            title: "YouTube Playlist Videos",
            description: "获取 YouTube 播放列表中的所有视频",
            requiresWebView: false,
            functionName: "getPlaylistVideos",
            sectionMode: true,
            cacheDuration: 1800, // 30分钟缓存
            params: [
                {
                    name: "playlistUrl",
                    title: "播放列表链接",
                    type: "input",
                    description: "YouTube 播放列表链接或ID",
                    value: "PLeLIBumxw6OzGRjVLD2oOXFXVLqWp2ryX"
                },
                {
                    name: "maxResults",
                    title: "每页结果数",
                    type: "count",
                    description: "每次请求获取的视频数量",
                    value: "20",
                    enumOptions: [
                        {
                            title: "10个视频",
                            value: "10"
                        },
                        {
                            title: "20个视频",
                            value: "20"
                        },
                        {
                            title: "30个视频",
                            value: "30"
                        },
                        {
                            title: "50个视频",
                            value: "50"
                        }
                    ]
                }
            ]
        }
    ]
};

// 获取最新的 YouTube API Key
async function getYouTubeAPIKey() {
    const CACHE_KEY = "youtube_api_key";
    const CACHE_TIME = 24 * 3600 * 1000; // 24小时缓存
    
    // 检查缓存
    const cached = Widget.cache.get(CACHE_KEY);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TIME) {
        return cached.key;
    }
    
    try {
        // 尝试从不同页面获取 API Key
        const urlsToTry = [
            "https://www.youtube.com",
            "https://www.youtube.com/feed/explore",
            "https://www.youtube.com/feed/trending"
        ];
        
        for (const url of urlsToTry) {
            try {
                const response = await Widget.http.get(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.5"
                    },
                    timeout: 10000
                });
                
                const html = response.data;
                
                // 更全面的正则匹配模式
                const patterns = [
                    /"INNERTUBE_API_KEY":"([^"]+)"/,
                    /"innertubeApiKey":"([^"]+)"/,
                    /INNERTUBE_API_KEY['"]?\s*:\s*['"]([^'"]+)['"]/i,
                    /innertubeApiKey['"]?\s*:\s*['"]([^'"]+)['"]/i,
                    /"key":"([^"]+)"/,
                    /window\.ytcfg\s*=\s*({.*?});/
                ];
                
                for (const pattern of patterns) {
                    const match = html.match(pattern);
                    if (match) {
                        let key = match[1];
                        
                        // 如果是 JSON 对象，解析它
                        if (pattern.toString().includes('ytcfg')) {
                            try {
                                const ytcfg = JSON.parse(match[1]);
                                key = ytcfg.INNERTUBE_API_KEY || ytcfg.innertubeApiKey;
                            } catch (e) {
                                continue;
                            }
                        }
                        
                        if (key && key.startsWith('AIza')) {
                            console.log(`从 ${url} 获取到 API Key: ${key}`);
                            
                            // 缓存 API Key
                            Widget.cache.set(CACHE_KEY, {
                                key: key,
                                timestamp: Date.now()
                            });
                            
                            return key;
                        }
                    }
                }
            } catch (error) {
                console.log(`尝试 ${url} 失败:`, error.message);
                continue;
            }
        }
        
        throw new Error("无法从任何页面获取 API Key");
        
    } catch (error) {
        console.error("获取 API Key 失败:", error);
        
        // 返回备用 Keys（最后的手段）
        const backupKeys = [
            "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8", // WEB
            "AIzaSyBUPetSUmoVD-5S3f4pZ4qPonXkT5k3JpA", // Android
            "AIzaSyCjc_pVEDi4qsv5MtC2dMXzpIaDoRFLsxw"  // iOS
        ];
        
        return backupKeys[Math.floor(Math.random() * backupKeys.length)];
    }
}

// 主函数：获取播放列表视频
async function getPlaylistVideos(params = {}) {
    try {
        // 参数处理
        let playlistUrl = params.playlistUrl || "";
        const maxResults = parseInt(params.maxResults) || 20;
        const page = parseInt(params.page) || 1;
        
        // 提取播放列表ID
        let playlistId = "";
        if (playlistUrl.includes("list=")) {
            const urlObj = new URL(playlistUrl);
            playlistId = urlObj.searchParams.get("list");
        } else if (/^[A-Za-z0-9_-]+$/.test(playlistUrl)) {
            // 如果输入的是纯ID
            playlistId = playlistUrl;
        } else {
            throw new Error("请输入有效的播放列表链接或ID");
        }
        
        if (!playlistId) {
            throw new Error("无法提取播放列表ID");
        }
        
        console.log(`开始获取播放列表 ${playlistId}，第 ${page} 页，每页 ${maxResults} 个`);
        
        // 获取 API Key
        const apiKey = await getYouTubeAPIKey();
        console.log(`使用 API Key: ${apiKey.substring(0, 10)}...`);
        
        // 构建请求
        const apiUrl = `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`;
        
        const requestBody = {
            context: {
                client: {
                    clientName: "WEB",
                    clientVersion: "2.20250101.00.00",
                    hl: "zh-CN",
                    gl: "CN"
                }
            },
            browseId: `VL${playlistId}`,
            params: "EgZ2aWRlb3M%3D" // 视频参数
        };
        
        // 如果有分页token
        if (params.continuationToken) {
            requestBody.continuation = params.continuationToken;
        }
        
        // 发送请求
        const response = await Widget.http.post(apiUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Origin": "https://www.youtube.com",
                "Referer": `https://www.youtube.com/playlist?list=${playlistId}`
            },
            data: JSON.stringify(requestBody),
            timeout: 15000
        });
        
        if (response.status !== 200) {
            throw new Error(`API 请求失败: ${response.status}`);
        }
        
        const data = response.data;
        
        // 解析响应
        const result = {
            items: [],
            hasMore: false,
            nextToken: null
        };
        
        // 提取视频
        const videos = extractVideosFromResponse(data);
        result.items = videos.slice(0, maxResults);
        
        // 提取分页token
        const continuationToken = findContinuationToken(data);
        if (continuationToken && videos.length >= maxResults) {
            result.hasMore = true;
            result.nextToken = continuationToken;
        }
        
        // 如果没有获取到视频，尝试备用方法
        if (result.items.length === 0) {
            console.log("API 方法未获取到视频，尝试网页解析...");
            const webVideos = await fetchFromWebPage(playlistId, maxResults);
            result.items = webVideos;
        }
        
        console.log(`成功获取 ${result.items.length} 个视频`);
        return result;
        
    } catch (error) {
        console.error("获取播放列表失败:", error);
        
        // 降级到网页解析
        try {
            const playlistId = extractPlaylistId(params.playlistUrl);
            const webVideos = await fetchFromWebPage(playlistId, params.maxResults || 20);
            return {
                items: webVideos,
                hasMore: false,
                nextToken: null
            };
        } catch (webError) {
            throw new Error(`所有方法都失败: ${error.message}, ${webError.message}`);
        }
    }
}

// 辅助函数：从 API 响应提取视频
function extractVideosFromResponse(data) {
    const videos = [];
    
    // 深度遍历查找视频
    function traverse(obj, path = '') {
        if (!obj || typeof obj !== 'object') return;
        
        // 检查是否是视频渲染器
        if (obj.videoId && obj.title && obj.title.runs && obj.title.runs[0]) {
            const video = {
                id: obj.videoId,
                title: obj.title.runs[0].text || '无标题',
                coverUrl: '',
                description: '',
                url: `https://www.youtube.com/watch?v=${obj.videoId}`,
                extra: {}
            };
            
            // 缩略图
            if (obj.thumbnail && obj.thumbnail.thumbnails && obj.thumbnail.thumbnails.length > 0) {
                video.coverUrl = obj.thumbnail.thumbnails[obj.thumbnail.thumbnails.length - 1].url;
            }
            
            // 时长
            if (obj.lengthText && obj.lengthText.simpleText) {
                video.extra.duration = obj.lengthText.simpleText;
            }
            
            // 上传者
            if (obj.ownerText && obj.ownerText.runs && obj.ownerText.runs[0]) {
                video.extra.uploader = obj.ownerText.runs[0].text;
            }
            
            // 观看次数
            if (obj.viewCountText && obj.viewCountText.simpleText) {
                video.extra.views = obj.viewCountText.simpleText;
            }
            
            videos.push(video);
            return;
        }
        
        // 递归遍历
        for (const key in obj) {
            if (Array.isArray(obj[key])) {
                obj[key].forEach((item, index) => {
                    traverse(item, `${path}.${key}[${index}]`);
                });
            } else if (typeof obj[key] === 'object') {
                traverse(obj[key], `${path}.${key}`);
            }
        }
    }
    
    traverse(data);
    return videos;
}

// 辅助函数：查找分页token
function findContinuationToken(data) {
    const tokens = [];
    
    function findToken(obj) {
        if (!obj || typeof obj !== 'object') return;
        
        if (obj.continuation && obj.continuation.continuationCommand && 
            obj.continuation.continuationCommand.token) {
            tokens.push(obj.continuation.continuationCommand.token);
        }
        
        for (const key in obj) {
            if (Array.isArray(obj[key])) {
                obj[key].forEach(item => findToken(item));
            } else if (typeof obj[key] === 'object') {
                findToken(obj[key]);
            }
        }
    }
    
    findToken(data);
    return tokens.length > 0 ? tokens[0] : null;
}

// 辅助函数：网页解析（备用）
async function fetchFromWebPage(playlistId, maxResults) {
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    
    const response = await Widget.http.get(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });
    
    // 简化的网页解析逻辑
    const html = response.data;
    const videos = [];
    
    // 使用正则提取视频信息
    const videoPattern = /"videoId":"([^"]+)","title":"([^"]+)"/g;
    let match;
    let count = 0;
    
    while ((match = videoPattern.exec(html)) !== null && count < maxResults) {
        const videoId = match[1];
        const title = match[2].replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => 
            String.fromCharCode(parseInt(grp, 16)));
        
        videos.push({
            id: videoId,
            title: title,
            coverUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            description: "来自网页解析",
            extra: {}
        });
        count++;
    }
    
    return videos;
}

// 辅助函数：提取播放列表ID
function extractPlaylistId(url) {
    if (!url) return "";
    
    try {
        if (url.includes("list=")) {
            const urlObj = new URL(url);
            return urlObj.searchParams.get("list");
        } else if (/^[A-Za-z0-9_-]+$/.test(url)) {
            return url;
        }
    } catch (e) {
        // 如果 URL 解析失败，尝试正则匹配
        const match = url.match(/list=([A-Za-z0-9_-]+)/);
        return match ? match[1] : url;
    }
    
    return "";
}
