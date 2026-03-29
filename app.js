// Mobile Application Core Logic
const App = {
    state: {
        isMasterAuthenticated: false,
        isUserAuthenticated: false,
        isAdminAuthenticated: false,
        currentUser: null,
        currentView: 'splash', // splash, master-gate, auth, home, course-details, admin, admin-login, admin-folders, admin-upload
        courses: [],
        unlockedCourses: [], // IDs of courses the user has unlocked
        progress: {},
        topics: [
            { id: '1', name: 'Web Security', subfolders: [
                { id: '101', name: 'XSS Attacks' },
                { id: '102', name: 'SQL Injection' }
            ]},
            { id: '2', name: 'Network Hacking', subfolders: [] }
        ],
        adminBreadcrumbs: ['Dashboard'],
        uploadProgress: 0,
        isUploading: false,
        activeFilter: 'ALL',
        logoDataUri: `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgZmlsbD0iIzAwMDAwMCIgcng9IjY0Ii8+PHBhdGggZmlsbD0iI2ZmMDAwMCIgZD0iTTEwMCAxMDBsNTAgNTAtNTAgNTB6TTQxMiAxMDBsLTUwIDUwIDUwIDUwek0xMDAgNDEybDUwLTUwLTUwLTUwek00MTIgNDEyIGwtNTAtNTAgNTAtNTB6Ii8+PHBhdGggZmlsbD0iI2ZmMDAwMCIgZD0iTTI1NiA1MGw0MCA0MC00MCA0MC00MC00MHpNMjU2IDQ2Mmw0MC00MC00MC00MC00MCA0MHoiLz48dGV4dCB4PSIyNTYiIHk9IjI4MCIgZmlsbD0iI2ZmZmZmZiIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC13ZWlnaHQ9ImJvbGQiPkNMSUNLRVI8L3RleHQ+PHRleHQgeD0iMjU2IiB5PSIzNDAiIGZpbGw9IiNmZjAwMDAiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtd2VpZ2h0PSJib2xkIj5LRUVQIFNFQ1VSRTwvdGV4dD48L3N2Zz4=`,
        ytPlayer: null, // New: YouTube player instance
        playbackSpeed: 1, // New: Custom speed tracking
        isAutoplay: true, // New: Autoplay state
        userStatus: 'ACTIVE', // ACTIVE, INACTIVE, SUSPENDED
        lastStatusUpdate: new Date().toISOString(),
        watchedDuration: {}, // New: Track seconds watched per video
        completedVideos: {}, // New: Track {videoId: timestamp}
        lastTickTime: null, // New: Anti-skip tracking
        notifications: [], // New: Push notification queue
        syncTimestamp: Date.now(), // Real-time sync tracker
        uploadMetrics: { total: 0, success: 0, failed: 0 }, // Admin monitoring
        playerVolume: 100, // New: Volume 0-100
        isMuted: false, // New: Mute state
        controlsVisible: true, // New: Visibility of overlay controls
        hideTimeout: null, // New: Timeout for auto-hiding controls
        editingCourse: null, // New: Course being edited by admin
        apiBase: localStorage.getItem('matrix_api_base') || window.location.origin, // Configurable API Base
        syncStatus: 'IDLE' // IDLE, SYNCING, SUCCESS, ERROR
    },

    init() {
        console.log('App initialization started...');
        this.loadStorage();
        this.syncWithServer(); // Initial fetch from server
        this.render();
        this.startSplash();
        this.loadYoutubeAPI();
        this.startRealTimeSync(); // Enable production sync
        this.initMobileHardware(); // Handle hardware buttons
    },

    updateApiBase(url) {
        if (!url) return alert('URL required');
        // Ensure URL doesn't have trailing slash
        const formattedUrl = url.endsWith('/') ? url.slice(0, -1) : url;
        this.state.apiBase = formattedUrl;
        localStorage.setItem('matrix_api_base', formattedUrl);
        alert('SERVER_ADDRESS_UPDATED: Reconnecting...');
        this.syncWithServer();
    },

    async syncWithServer() {
        console.log('Syncing with central server...');
        this.state.syncStatus = 'SYNCING';
        this.render();
        try {
            // First, try to fetch from a public free JSON bin as a fallback cloud
            // This ensures sync even if the local server isn't running
            const cloudUrl = 'https://api.npoint.io/0315252875f8f8f8f8f8'; // Placeholder for free cloud sync
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); 

            // Try Local/Configured Server first
            const response = await fetch(`${this.state.apiBase}/api/data`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                this.updateLocalData(data);
                this.state.syncStatus = 'SUCCESS';
                this.render();
                return;
            }
        } catch (e) {
            console.warn('Local server unreachable, attempting peer-to-peer cloud sync...');
        }
        
        // Final fallback: Use device-local data if all network sync fails
        this.state.syncStatus = 'ERROR';
        this.render();
    },

    updateLocalData(data) {
        if (data.courses && Array.isArray(data.courses)) {
            this.state.courses = data.courses;
        }
        if (data.topics && Array.isArray(data.topics)) {
            this.state.topics = data.topics;
        }
        this.saveStorageLocal();
    },

    async pushToServer() {
        this.state.syncStatus = 'SYNCING';
        this.render();
        
        const data = {
            courses: this.state.courses,
            topics: this.state.topics,
            syncTime: Date.now()
        };

        try {
            // 1. Push to Local Server
            const response = await fetch(`${this.state.apiBase}/api/data`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                localStorage.setItem('matrix_last_sync', data.syncTime);
                this.state.syncStatus = 'SUCCESS';
                this.render();
                console.log('Cloud Update: Broadcast Successful');
            }
        } catch (e) {
            console.error('Local push failed, content saved locally only.', e);
            this.state.syncStatus = 'ERROR';
            this.render();
            alert('SYNC_ERROR: Video saved on THIS phone, but could not broadcast to OTHERS. Please ensure your PC server is running and the IP address is correct in Admin settings.');
        }
    },

    saveStorageLocal() {
        localStorage.setItem('matrix_courses', JSON.stringify(this.state.courses));
        localStorage.setItem('matrix_topics', JSON.stringify(this.state.topics));
    },

    initMobileHardware() {
        // Handle Android Back Button for Capacitor/PWA
        window.addEventListener('popstate', (e) => {
            if (this.state.currentView !== 'home') {
                this.navigate('home');
            }
        });
        
        // Check for Vibration Support
        this.state.canVibrate = 'vibrate' in navigator;
    },

    vibrate(pattern = 10) {
        if (this.state.canVibrate) {
            navigator.vibrate(pattern);
        }
    },

    startRealTimeSync() {
        // Poll for updates every 10 seconds for cross-device sync
        setInterval(async () => {
            try {
                const response = await fetch(`${this.state.apiBase}/api/data`);
                if (response.ok) {
                    const data = await response.json();
                    const lastSync = localStorage.getItem('matrix_last_sync') || 0;
                    
                    if (data.syncTime && data.syncTime > lastSync) {
                        console.log('Production Sync: New content detected from cloud!');
                        this.state.courses = data.courses || this.state.courses;
                        this.state.topics = data.topics || this.state.topics;
                        this.saveStorageLocal();
                        this.state.syncStatus = 'SUCCESS';
                        this.render();
                        localStorage.setItem('matrix_last_sync', data.syncTime);
                        
                        // Show in-app push notification
                        this.pushNotification('🚀 NEW_CONTENT_AVAILABLE', 'A new video has been added to the hub.');
                    } else {
                        this.state.syncStatus = 'SUCCESS';
                    }
                } else {
                    this.state.syncStatus = 'ERROR';
                }
            } catch (e) {
                this.state.syncStatus = 'ERROR';
                console.debug('Sync check interrupted (possibly offline)');
            }
        }, 10000);
    },

    pushNotification(title, msg) {
        const id = Date.now();
        this.state.notifications.push({ id, title, msg });
        this.render();
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            this.state.notifications = this.state.notifications.filter(n => n.id !== id);
            this.render();
        }, 5000);
    },

    loadYoutubeAPI() {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            window.onYouTubeIframeAPIReady = () => {
                console.log('YouTube API Ready');
            };
        }
    },

    loadStorage() {
        try {
            const savedMetrics = localStorage.getItem('matrix_upload_metrics');
            if (savedMetrics) {
                this.state.uploadMetrics = JSON.parse(savedMetrics);
            }

            const savedAuth = localStorage.getItem('matrix_auth');
            if (savedAuth) {
                this.state.currentUser = JSON.parse(savedAuth);
                this.state.isUserAuthenticated = true;
            }

            const savedAdminAuth = sessionStorage.getItem('admin_session');
            if (savedAdminAuth === 'active') {
                this.state.isAdminAuthenticated = true;
            }
            
            const savedProgress = localStorage.getItem('matrix_progress');
            if (savedProgress) {
                this.state.progress = JSON.parse(savedProgress);
            }

            const savedUnlocked = localStorage.getItem('matrix_unlocked');
            if (savedUnlocked) {
                this.state.unlockedCourses = JSON.parse(savedUnlocked);
            }

            const savedCompleted = localStorage.getItem('matrix_completed');
            if (savedCompleted) {
                this.state.completedVideos = JSON.parse(savedCompleted);
            }

            const savedWatched = localStorage.getItem('matrix_watched_time');
            if (savedWatched) {
                this.state.watchedDuration = JSON.parse(savedWatched);
            }

            // Load courses from storage or use defaults
            const savedCourses = localStorage.getItem('matrix_courses');
            if (savedCourses) {
                this.state.courses = JSON.parse(savedCourses);
            } else {
                // Default Mock courses
                this.state.courses = [
                    { id: '1', title: 'Ethical Hacking 101', provider: 'YouTube', type: 'private', price: 1, thumbnail: 'https://img.youtube.com/vi/3Kq1MIfTWCE/0.jpg', description: 'Master the basics of ethical hacking and security.', password: 'PASS123', url: 'https://www.youtube.com/watch?v=3Kq1MIfTWCE' },
                    { id: '2', title: 'Cloud Exploitation', provider: 'Google Drive', type: 'private', price: 1, thumbnail: 'https://img.youtube.com/vi/3Kq1MIfTWCE/1.jpg', description: 'Advanced cloud security vulnerabilities.', password: 'PASS123', url: 'https://drive.google.com/file/d/1XXXXX' },
                    { id: '3', title: 'Network Defense', provider: 'YouTube', type: 'private', price: 1, thumbnail: 'https://img.youtube.com/vi/3Kq1MIfTWCE/2.jpg', description: 'Protecting your network from intrusions.', password: 'PASS123', url: 'https://www.youtube.com/watch?v=3Kq1MIfTWCE' }
                ];
                this.saveCourses();
            }

            // Load topics from storage or use defaults
            const savedTopics = localStorage.getItem('matrix_topics');
            if (savedTopics) {
                this.state.topics = JSON.parse(savedTopics);
            } else {
                this.state.topics = [
                    { id: '1', name: 'Web Security', subfolders: [
                        { id: '101', name: 'XSS Attacks' },
                        { id: '102', name: 'SQL Injection' }
                    ]},
                    { id: '2', name: 'Network Hacking', subfolders: [] }
                ];
                this.saveTopics();
            }
        } catch (e) {
            console.error('CRITICAL_STORAGE_FAILURE:', e);
            // Don't crash, but log the error
        }
    },

    saveCourses() {
        this.saveStorageLocal();
        this.pushToServer(); // Push to shared cloud
        
        // Monitoring: Track upload success
        this.state.uploadMetrics.total++;
        this.state.uploadMetrics.success++;
        this.saveMetrics();
    },

    saveMetrics() {
        localStorage.setItem('matrix_upload_metrics', JSON.stringify(this.state.uploadMetrics));
    },

    saveTopics() {
        this.saveStorageLocal();
        this.pushToServer(); // Push to shared cloud
    },

    saveWatchStats() {
        localStorage.setItem('matrix_watched_time', JSON.stringify(this.state.watchedDuration));
        localStorage.setItem('matrix_completed', JSON.stringify(this.state.completedVideos));
    },

    saveAuth(user) {
        localStorage.setItem('matrix_auth', JSON.stringify(user));
        this.state.currentUser = user;
        this.state.isUserAuthenticated = true;
    },

    startSplash() {
        setTimeout(() => {
            console.log('Splash finished, navigating to master-gate...');
            this.navigate('master-gate');
        }, 2500);
    },

    setFilter(filter) {
        this.state.activeFilter = filter;
        this.render();
    },

    navigate(view) {
        // Close any overlays when navigating
        const overlay = document.getElementById('course-pass-overlay');
        if (overlay) overlay.remove();

        // 1. Master Authentication Guard
        if (!this.state.isMasterAuthenticated && view !== 'splash' && view !== 'master-gate' && view !== 'admin-login') {
            console.warn('Blocked navigation to ' + view + ': Master Auth Required');
            this.state.currentView = 'master-gate';
            this.render();
            return;
        }

        // 2. Admin Authentication Guard (SECURITY FIX)
        if (view.startsWith('admin') && view !== 'admin-login' && !this.state.isAdminAuthenticated) {
            console.warn('Blocked unauthorized access to admin view: ' + view);
            alert('SECURITY_ALERT: UNAUTHORIZED_ACCESS_BLOCKED');
            this.state.currentView = 'auth';
            this.render();
            return;
        }

        // 3. User Suspension Guard
        if (this.state.userStatus === 'SUSPENDED' && !['master-gate', 'analytics', 'auth'].includes(view)) {
            alert('CRITICAL_ERROR: ACCOUNT_SUSPENDED. Contact administrator via WhatsApp.');
            this.state.currentView = 'analytics';
            this.render();
            return;
        }

        // Clean up player when leaving details
        if (this.state.currentView === 'course-details' && view !== 'course-details') {
            this.removeKeyboardShortcuts();
            if (this.state.ytPlayer) {
                try { this.state.ytPlayer.destroy(); } catch(e) {}
                this.state.ytPlayer = null;
            }
            if (this.state.trackingInterval) clearInterval(this.state.trackingInterval);
        }

        console.log('Navigating to: ' + view);
        this.state.currentView = view;
        this.render();
    },

    updateUserStatus(status) {
        console.log(`System status update: ${status}`);
        this.state.userStatus = status;
        this.state.lastStatusUpdate = new Date().toISOString();
        this.render();
    },

    refreshStatusData() {
        console.log('Refreshing user data from core...');
        // Simulate a small delay for network-like feel
        this.render(); 
        setTimeout(() => {
            alert('SYSTEM_DATA_SYNC_COMPLETE');
        }, 300);
    },

    handleMasterAuth(password) {
        console.log('Validating master password...');
        if (password.toUpperCase() === 'MATRIX') {
            this.vibrate([10, 50, 10]); // Success pattern
            this.state.isMasterAuthenticated = true;
            console.log('Master Auth Success');
            if (this.state.isUserAuthenticated) {
                this.navigate('home');
            } else {
                this.navigate('auth');
            }
        } else {
            this.vibrate(200); // Fail pattern
            alert('ACCESS DENIED: INCORRECT MASTER PASSWORD');
        }
    },

    handleAdminAuth(password) {
        if (password === 'ARVIMATRIX') {
            this.vibrate([20, 10, 20]);
            this.state.isAdminAuthenticated = true;
            this.state.isMasterAuthenticated = true; // Admin login also unlocks the master gate
            sessionStorage.setItem('admin_session', 'active');
            this.navigate('admin');
        } else {
            this.vibrate(200);
            alert('INVALID ADMIN CREDENTIALS');
        }
    },

    handleUserAuth(username, password, type = 'login') {
        const user = { username, id: 'USER_' + Math.floor(Math.random() * 10000) };
        this.saveAuth(user);
        this.navigate('home');
    },

    handlePayment(id) {
        if (!this.state.isUserAuthenticated) return this.navigate('auth');
        
        // Check if already unlocked
        if (this.state.unlockedCourses.includes(String(id))) {
            return this.showCourse(id);
        }

        const course = this.state.courses.find(c => String(c.id) === String(id));
        const msg = encodeURIComponent(`I want to pay ₹1 for ${course.title}. (CourseID: ${course.id}) UserID: ${this.state.currentUser.username}`);
        window.open(`https://wa.me/918606179159?text=${msg}`, '_blank');
        
        // Custom Password Interface Overlay
        const overlay = document.createElement('div');
        overlay.id = 'course-pass-overlay';
        overlay.className = 'fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 font-mono';
        overlay.innerHTML = `
            <div class="w-full max-w-sm border-2 border-red-500 bg-black p-8 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                <h3 class="text-red-500 text-lg mb-2 uppercase tracking-widest font-bold underline">Course_Locked</h3>
                <p class="text-[10px] text-red-500/60 mb-6 uppercase">₹1 Payment Required. Enter Unique Key for this Video.</p>
                
                <div class="space-y-6">
                    <div>
                        <label class="block text-[8px] text-red-500/40 mb-1 uppercase">Video_Access_Key</label>
                        <input type="password" id="c-unlock-pass" class="w-full bg-black border border-red-500 text-red-500 p-3 focus:outline-none focus:ring-1 focus:ring-red-400" placeholder="********">
                    </div>
                    <div class="flex space-x-4">
                        <button onclick="document.getElementById('course-pass-overlay').remove()" class="flex-1 border border-red-500/30 text-red-500/50 py-2 text-xs uppercase hover:bg-red-500/10 transition-all">Cancel</button>
                        <button id="btn-unlock-final" class="flex-2 bg-red-500 text-black py-2 px-6 font-bold text-xs uppercase hover:bg-red-400 transition-all">Unlock_Video</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('btn-unlock-final').onclick = () => {
            const pass = document.getElementById('c-unlock-pass').value;
            const targetPass = course.password || 'PASS123';
            
            if (pass === targetPass) {
                alert('ACCESS_GRANTED: VIDEO_UNLOCKED');
                
                // Persist unlock
                if (!this.state.unlockedCourses.includes(String(id))) {
                    this.state.unlockedCourses.push(String(id));
                    localStorage.setItem('matrix_unlocked', JSON.stringify(this.state.unlockedCourses));
                }
                
                overlay.remove();
                this.showCourse(id);
            } else {
                alert('ACCESS_DENIED: INVALID_KEY');
            }
        };
    },

    createTopic(name) {
        if (!name) return alert('Topic name required');
        const newTopic = { id: String(Date.now()), name, subfolders: [] };
        this.state.topics.push(newTopic);
        this.saveTopics();
        this.render();
    },

    createSubfolder(topicId, name) {
        if (!name) return;
        console.log('Creating subfolder for topic ID:', topicId);
        const topic = this.state.topics.find(t => String(t.id) === String(topicId));
        if (topic) {
            if (!topic.subfolders) topic.subfolders = [];
            topic.subfolders.push({ id: String(Date.now()), name: name });
            this.saveTopics();
            this.render();
        } else {
            console.error('Topic not found for ID:', topicId);
        }
    },

    showSubfolderModal(topicId) {
        const topic = this.state.topics.find(t => String(t.id) === String(topicId));
        if (!topic) return;

        const overlay = document.createElement('div');
        overlay.id = 'subfolder-modal-overlay';
        overlay.className = 'fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 font-mono';
        overlay.innerHTML = `
            <div class="w-full max-w-sm border-2 border-green-500 bg-black p-8 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                <h3 class="text-green-500 text-lg mb-2 uppercase tracking-widest font-bold underline">Add_Subtopic</h3>
                <p class="text-[10px] text-green-500/60 mb-6 uppercase text-shadow-glow">Target: ${topic.name}</p>
                
                <div class="space-y-6">
                    <div>
                        <label class="block text-[8px] text-green-500/40 mb-1 uppercase">Subtopic_Name</label>
                        <input type="text" id="subfolder-name-input" class="w-full bg-black border border-green-500 text-green-500 p-3 focus:outline-none focus:ring-1 focus:ring-green-400" placeholder="e.g. Advanced SQLi">
                    </div>
                    <div class="flex space-x-4">
                        <button onclick="document.getElementById('subfolder-modal-overlay').remove()" class="flex-1 border border-green-500/30 text-green-500/50 py-2 text-xs uppercase hover:bg-red-500/10 hover:text-red-500 transition-all">Cancel</button>
                        <button id="btn-create-sub-final" class="flex-2 bg-green-500 text-black py-2 px-6 font-bold text-xs uppercase hover:bg-green-400 transition-all">Create_SUB</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('subfolder-name-input');
        input.focus();

        document.getElementById('btn-create-sub-final').onclick = () => {
            const name = input.value.trim();
            if (name) {
                this.createSubfolder(topicId, name);
                overlay.remove();
            } else {
                alert('ERROR: NAME_REQUIRED');
            }
        };
    },

    // Video Upload Logic (Updated for URL-based content)
    handleVideoUpload(e) {
        e.preventDefault();
        const title = document.getElementById('v-title').value;
        const url = document.getElementById('v-url').value;
        const topicId = document.getElementById('v-topic').value;
        const customPass = document.getElementById('v-pass').value;

        // Validation
        if (!title || title.length < 5) return alert('Title must be at least 5 characters');
        if (!url) return alert('Provide an external YouTube or GDrive link');
        
        App.state.isUploading = true;
        App.render();

        // Simulate Upload Process for Metadata
        let progress = 0;
        const interval = setInterval(() => {
            progress += 25;
            App.state.uploadProgress = progress;
            App.render();
            if (progress >= 100) {
                clearInterval(interval);
                
                // Extract YouTube ID for thumbnail if possible
                let thumbnail = 'https://img.youtube.com/vi/3Kq1MIfTWCE/maxresdefault.jpg';
                const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
                const match = url.match(regExp);
                const ytId = (match && match[7].length == 11) ? match[7] : null;
                if (ytId) {
                    thumbnail = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
                }

                if (App.state.editingCourse) {
                    // Update existing course
                    const index = App.state.courses.findIndex(c => String(c.id) === String(App.state.editingCourse.id));
                    if (index !== -1) {
                        App.state.courses[index] = {
                            ...App.state.courses[index],
                            title: title,
                            url: url,
                            topicId: topicId,
                            thumbnail: thumbnail,
                            description: document.getElementById('v-desc').value || 'No description provided.',
                            password: customPass || 'PASS123'
                        };
                        alert('CONTENT_UPDATED_SUCCESSFULLY: ' + title);
                    }
                    App.state.editingCourse = null;
                } else {
                    // Add new course to state (Mocking database save)
                    const newCourse = {
                        id: String(Date.now()),
                        title: title,
                        provider: url.includes('drive.google.com') ? 'Google Drive' : 'YouTube',
                        type: 'private',
                        price: 1, // Price set to ₹1
                        thumbnail: thumbnail,
                        description: document.getElementById('v-desc').value || 'No description provided.',
                        url: url,
                        topicId: topicId,
                        password: customPass || 'PASS123'
                    };
                    App.state.courses.unshift(newCourse);
                    alert('CONTENT_LINKED_SUCCESSFULLY: ' + title);
                }
                
                App.saveCourses();
                App.state.isUploading = false;
                App.state.uploadProgress = 0;
                App.navigate('admin');
            }
        }, 500);
    },

    extractYtThumb(url) {
        // Improved regex to capture YouTube ID from various formats
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        const id = (match && match[7].length == 11) ? match[7] : null;

        if (id) {
            const thumbUrl = `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
            const preview = document.getElementById('thumb-preview');
            if (preview) {
                preview.src = thumbUrl;
                preview.classList.remove('hidden');
                // Hide the placeholder text
                const placeholder = preview.nextElementSibling;
                if (placeholder) placeholder.classList.add('hidden');
            }
        }
    },

    deleteCourse(id) {
        if (confirm('Are you sure you want to delete this video?')) {
            this.state.courses = this.state.courses.filter(c => String(c.id) !== String(id));
            this.saveCourses();
            this.render();
        }
    },

    editCourse(id) {
        const course = this.state.courses.find(c => String(c.id) === String(id));
        if (course) {
            this.state.editingCourse = { ...course }; // Clone course for editing
            this.navigate('admin-upload');
        }
    },

    cancelEdit() {
        this.state.editingCourse = null;
        this.navigate('admin');
    },

    removeTopic(id) {
        if (confirm('Are you sure you want to remove this topic and all its contents?')) {
            this.state.topics = this.state.topics.filter(t => String(t.id) !== String(id));
            this.saveTopics();
            this.render();
        }
    },

    removeSubfolder(topicId, subId) {
        if (confirm('Remove this subfolder?')) {
            const topic = this.state.topics.find(t => String(t.id) === String(topicId));
            if (topic) {
                topic.subfolders = topic.subfolders.filter(s => String(s.id) !== String(subId));
                this.saveTopics();
                this.render();
            }
        }
    },

    handleThumbnailPreview(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('thumb-preview').src = e.target.result;
                document.getElementById('thumb-preview').classList.remove('hidden');
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    render() {
        const root = document.getElementById('app');
        if (!root) return;
        
        // Production: In-App Notification Overlay
        const notificationHtml = this.state.notifications.map(n => `
            <div class="fixed top-4 right-4 left-4 z-[200] bg-green-500 text-black p-4 shadow-[0_0_30px_rgba(34,197,94,0.5)] border-2 border-white animate-bounce">
                <div class="flex items-center space-x-3">
                    <span class="text-2xl">🔔</span>
                    <div>
                        <div class="text-xs font-black uppercase tracking-tighter">${n.title}</div>
                        <div class="text-[8px] uppercase tracking-widest opacity-80">${n.msg}</div>
                    </div>
                </div>
            </div>
        `).join('');

        root.innerHTML = notificationHtml;
        console.log('Rendering view: ' + this.state.currentView);
        
        try {
            // Using a self-reference to App.views to avoid 'this' issues if called from event listeners
            const views = App.views;
            switch(this.state.currentView) {
                case 'splash': root.innerHTML = views.splash(); break;
                case 'master-gate': root.innerHTML = views.masterGate(); break;
                case 'auth': root.innerHTML = views.auth(); break;
                case 'home': root.innerHTML = views.home(this.state.courses); break;
                case 'course-details': root.innerHTML = views.courseDetails(this.state.selectedCourse); break;
                case 'admin-login': root.innerHTML = views.adminLogin(); break;
                case 'admin': root.innerHTML = views.admin(); break;
                case 'admin-folders': root.innerHTML = views.adminFolders(); break;
                case 'admin-upload': root.innerHTML = views.adminUpload(); break;
                case 'admin-settings': root.innerHTML = views.adminSettings(); break;
                case 'analytics': root.innerHTML = views.analytics(); break;
                case 'chat': root.innerHTML = views.chat(); break;
                case 'legal': root.innerHTML = views.legal(); break;
                default: root.innerHTML = views.splash();
            }

            // Initialize drag and drop if in upload view
            if (this.state.currentView === 'admin-upload') {
                const dropzone = document.getElementById('dropzone');
                if (dropzone) {
                    dropzone.ondragover = (e) => { e.preventDefault(); dropzone.classList.add('border-green-400'); };
                    dropzone.ondragleave = () => dropzone.classList.remove('border-green-400');
                    dropzone.ondrop = (e) => {
                        e.preventDefault();
                        document.getElementById('v-file').files = e.dataTransfer.files;
                        alert('FILE_CAPTURED: ' + e.dataTransfer.files[0].name);
                    };
                }
            }
        } catch (error) {
            console.error('Rendering Error:', error);
            root.innerHTML = `
                <div class="h-screen w-screen flex flex-col items-center justify-center bg-black p-8 font-mono">
                    <div class="text-red-500 mb-4">CRITICAL_SYSTEM_ERROR</div>
                    <div class="text-green-500/50 text-xs mb-8">${error.message}</div>
                    <button onclick="location.reload()" class="border border-green-500 px-6 py-2 text-green-500">REBOOT</button>
                </div>
            `;
        }
    },

    views: {
        splash: function() { return `
            <div class="h-screen w-screen flex flex-col items-center justify-center bg-black animate-pulse">
                <img src="${App.state.logoDataUri}" class="w-32 h-32 mb-6 object-contain shadow-glow rounded-xl" onerror="this.src='logo.png'">
                <h1 class="text-green-500 text-4xl font-mono tracking-tighter text-shadow-glow">CLICKER</h1>
                <div class="mt-8 w-48 h-1 bg-gray-900 overflow-hidden">
                    <div class="h-full bg-green-500 w-1/2 animate-[loading_2s_ease-in-out_infinite]"></div>
                </div>
            </div>
        `; },
        masterGate: function() { return `
            <div class="h-screen w-screen flex flex-col items-center justify-center bg-black p-8 font-mono">
                <img src="${App.state.logoDataUri}" class="w-24 h-24 mb-6 object-contain shadow-glow rounded-xl" onerror="this.src='logo.png'">
                <div class="border-2 border-green-500 p-8 w-full max-w-md bg-black/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                    <h2 class="text-green-500 text-xl mb-6 text-center underline">SYSTEM_LOCK</h2>
                    <p class="text-green-500/70 mb-4 text-xs">ENTER MASTER KEY TO DECRYPT INTERFACE</p>
                    <input type="password" id="master-pass" placeholder="********" 
                        class="w-full bg-black border border-green-500 text-green-500 p-3 mb-6 focus:outline-none focus:ring-1 focus:ring-green-400">
                    <button onclick="App.handleMasterAuth(document.getElementById('master-pass').value)"
                        class="w-full bg-green-500 text-black py-3 font-bold hover:bg-green-400 transition-colors">DECRYPT</button>
                    
                    <div class="mt-8 text-center">
                        <span onclick="App.navigate('admin-login')" class="text-[8px] text-green-500/20 cursor-pointer hover:text-green-500/50 transition-all uppercase tracking-widest">Admin Access Restricted</span>
                    </div>
                </div>
            </div>
        `; },
        adminLogin: function() { return `
            <div class="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-mono">
                <img src="${App.state.logoDataUri}" class="w-24 h-24 mb-8 object-contain shadow-glow" onerror="this.src='logo.png'">
                <div class="w-full max-w-sm border border-green-500 p-8 bg-black">
                    <div class="flex justify-between items-center mb-8">
                        <button onclick="App.navigate('master-gate')" class="text-green-500 text-xs hover:underline">← BACK</button>
                        <h2 class="text-green-500 text-2xl font-bold underline">ADMIN_ACCESS</h2>
                    </div>
                    <div class="space-y-6">
                        <div>
                            <label class="block text-[10px] text-green-500/50 mb-2">RESTRICTED_KEY</label>
                            <input type="password" id="admin-pass" class="w-full bg-black border border-green-500 text-green-500 p-3 focus:ring-1 focus:ring-green-500 outline-none">
                        </div>
                        <button onclick="App.handleAdminAuth(document.getElementById('admin-pass').value)"
                            class="w-full bg-green-500 text-black py-3 font-bold hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)]">VALIDATE</button>
                    </div>
                </div>
            </div>
        `; },
        admin: function() { return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24 lg:max-w-6xl lg:mx-auto lg:border-x lg:border-green-500/10">
                ${App.views.adminHeader('Admin Dashboard')}
                <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div onclick="App.navigate('admin-folders')" class="border border-green-500/30 p-8 bg-green-950/10 cursor-pointer hover:bg-green-500/5 transition-all group shadow-lg">
                        <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📁</div>
                        <h3 class="text-xl group-hover:text-green-400 transition-colors">TOPIC_MANAGEMENT</h3>
                        <p class="text-xs text-green-500/50 mt-2 leading-relaxed">Manage hierarchical folder structures, categories, and organize your content library.</p>
                    </div>
                    <div onclick="App.navigate('admin-upload')" class="border border-green-500/30 p-8 bg-green-950/10 cursor-pointer hover:bg-green-500/5 transition-all group shadow-lg">
                        <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">📤</div>
                        <h3 class="text-xl group-hover:text-green-400 transition-colors">VIDEO_UPLOADER</h3>
                        <p class="text-xs text-green-500/50 mt-2 leading-relaxed">Link new video content from YouTube or Google Drive and update existing metadata.</p>
                    </div>
                    <div onclick="App.navigate('admin-settings')" class="border border-green-500/30 p-8 bg-green-950/10 cursor-pointer hover:bg-green-500/5 transition-all group shadow-lg">
                        <div class="text-4xl mb-4 group-hover:scale-110 transition-transform">🌐</div>
                        <h3 class="text-xl group-hover:text-green-400 transition-colors">NETWORK_CONFIG</h3>
                        <p class="text-xs text-green-500/50 mt-2 leading-relaxed">Configure master server IP for real-time cross-device synchronization and cloud broadcast.</p>
                    </div>
                </div>
                ${App.views.nav()}
            </div>
        `; },
        adminFolders: function() { return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24 text-shadow-glow">
                ${App.views.adminHeader('Topics > Folders')}
                <div class="p-6 space-y-8">
                    <div class="border border-green-500 p-4 bg-green-950/5">
                        <h3 class="text-xs mb-4 uppercase tracking-widest">Add_New_Topic</h3>
                        <div class="flex">
                            <input type="text" id="new-topic" class="flex-1 bg-black border border-green-500/50 p-2 text-sm outline-none focus:border-green-500">
                            <button onclick="App.createTopic(document.getElementById('new-topic').value)" class="bg-green-500 text-black px-4 font-bold text-xs ml-2 hover:bg-green-400">+</button>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <h3 class="text-xs text-green-500/50 uppercase tracking-widest">Existing_Hierarchy</h3>
                        ${App.state.topics.map(topic => `
                            <div class="border border-green-500/20 p-4 relative group hover:border-green-500/50 transition-all">
                                <div class="flex justify-between items-center mb-4">
                                    <span class="text-sm font-bold">📂 ${topic.name}</span>
                                    <div class="flex space-x-2">
                                        <button onclick="App.showSubfolderModal('${topic.id}')" class="text-[8px] border border-green-500/50 px-2 py-1 hover:bg-green-500 hover:text-black transition-all">+ SUB</button>
                                        <button onclick="App.removeTopic('${topic.id}')" class="text-[8px] border border-red-500/50 text-red-500/70 px-2 py-1 hover:bg-red-500 hover:text-white transition-all">REMOVE</button>
                                    </div>
                                </div>
                                <div class="ml-6 space-y-2">
                                    ${(topic.subfolders || []).map(sub => `
                                        <div class="text-xs text-green-500/70 flex justify-between items-center py-1 border-b border-green-500/5">
                                            <span>|_ 📁 ${sub.name}</span>
                                            <button onclick="App.removeSubfolder('${topic.id}', '${sub.id}')" class="text-[6px] text-red-500/40 hover:text-red-500 transition-all">DELETE</button>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="space-y-4 pt-8">
                        <h3 class="text-xs text-green-500/50 uppercase tracking-widest">Video_Database</h3>
                        <div class="space-y-2">
                            ${App.state.courses.map(course => `
                                <div class="flex justify-between items-center p-2 border border-green-500/10 text-[10px]">
                                    <span class="truncate pr-4">${course.title}</span>
                                    <div class="flex space-x-3">
                                        <button onclick="App.editCourse('${course.id}')" class="text-green-500/60 hover:text-green-500 uppercase font-bold">Edit</button>
                                        <button onclick="App.deleteCourse('${course.id}')" class="text-red-500/60 hover:text-red-500 uppercase font-bold">Delete</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                ${App.views.nav()}
            </div>
        `; },
        adminUpload: function() { 
            const isEdit = !!App.state.editingCourse;
            const course = App.state.editingCourse || {};

            return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24">
                ${App.views.adminHeader(isEdit ? 'Edit Video Metadata' : 'Video Linker')}
                <div class="p-6">
                    <form onsubmit="App.handleVideoUpload(event)" class="space-y-6">
                        <div class="border-2 border-dashed border-green-500/30 p-8 text-center bg-green-950/5">
                            <div class="text-4xl mb-2">${isEdit ? '✏️' : '🔗'}</div>
                            <p class="text-xs font-bold uppercase tracking-widest text-shadow-glow">${isEdit ? 'Modify Content' : 'Link Content [FREE_MODE]'}</p>
                            <p class="text-[8px] text-green-500/30 mt-1">${isEdit ? `Editing: ${course.title}` : 'YouTube or Google Drive URL'}</p>
                        </div>

                        <div class="grid grid-cols-1 gap-4">
                            <div>
                                <label class="text-[10px] text-green-500/50 block mb-1 uppercase">Video Title</label>
                                <input type="text" id="v-title" value="${course.title || ''}" class="w-full bg-black border border-green-500/30 p-3 text-sm outline-none focus:border-green-500" placeholder="e.g., Advanced SQL Injection">
                            </div>
                            
                            <div>
                                <label class="text-[10px] text-green-500/50 block mb-1 uppercase">Target Category</label>
                                <select id="v-topic" class="w-full bg-black border border-green-500/30 p-3 text-sm outline-none focus:border-green-500">
                                    ${App.state.topics.map(t => `
                                        <optgroup label="${t.name}">
                                            <option value="${t.id}" ${course.topicId === t.id ? 'selected' : ''}>${t.name} (Root)</option>
                                            ${t.subfolders.map(s => `<option value="${s.id}" ${course.topicId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                                        </optgroup>
                                    `).join('')}
                                </select>
                            </div>

                            <div>
                                <label class="text-[10px] text-green-500/50 block mb-1 uppercase">Content URL (YouTube/Drive)</label>
                                <input type="url" id="v-url" value="${course.url || ''}" oninput="App.extractYtThumb(this.value)" class="w-full bg-black border border-green-500/30 p-3 text-sm outline-none focus:border-green-500" placeholder="https://www.youtube.com/watch?v=...">
                            </div>

                            <div>
                                <label class="text-[10px] text-green-500/50 block mb-1 uppercase">Preview Thumbnail</label>
                                <div id="thumb-preview-container" class="w-full h-32 border border-green-500/30 overflow-hidden bg-gray-900 flex items-center justify-center">
                                    <img id="thumb-preview" src="${course.thumbnail || ''}" class="${course.thumbnail ? '' : 'hidden'} w-full h-full object-cover">
                                    <span class="text-[8px] text-green-500/20 ${course.thumbnail ? 'hidden' : ''}">AUTO_THUMBNAIL_DETECT</span>
                                </div>
                            </div>

                            <div>
                                <label class="text-[10px] text-green-500/50 block mb-1 uppercase">Description</label>
                                <textarea id="v-desc" class="w-full h-24 bg-black border border-green-500/30 p-3 text-sm outline-none focus:border-green-500" placeholder="Enter course syllabus and details...">${course.description || ''}</textarea>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="text-[10px] text-green-500/50 block mb-1 uppercase">Access Price (INR)</label>
                                    <input type="number" id="v-price" value="1" readonly class="w-full bg-black border border-green-500/30 p-3 text-sm outline-none opacity-50 cursor-not-allowed">
                                </div>
                                <div>
                                    <label class="text-[10px] text-green-500/50 block mb-1 uppercase">Unlock Password</label>
                                    <input type="text" id="v-pass" value="${course.password || 'PASS123'}" class="w-full bg-black border border-green-500/30 p-3 text-sm outline-none focus:border-green-500">
                                </div>
                            </div>
                        </div>

                        ${App.state.isUploading ? `
                            <div class="space-y-2">
                                <div class="w-full bg-gray-900 h-2 overflow-hidden rounded-full">
                                    <div class="bg-green-500 h-full transition-all duration-300 shadow-[0_0_10px_#22c55e]" style="width: ${App.state.uploadProgress}%"></div>
                                </div>
                                <div class="flex justify-between text-[8px] text-green-500 uppercase">
                                    <span>Syncing_Metadata...</span>
                                    <span>${App.state.uploadProgress}%</span>
                                </div>
                            </div>
                        ` : `
                            <div class="flex space-x-4">
                                ${isEdit ? `<button type="button" onclick="App.cancelEdit()" class="flex-1 border border-red-500/50 text-red-500 py-4 font-bold hover:bg-red-500 hover:text-black transition-all uppercase">Cancel</button>` : ''}
                                <button type="submit" class="flex-2 w-full bg-green-500 text-black py-4 font-bold hover:bg-green-400 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] uppercase">${isEdit ? 'Update Metadata' : 'Publish Free Content'}</button>
                            </div>
                        `}
                    </form>
                </div>
                ${App.views.nav()}
            </div>
        `; },
        adminSettings: function() {
            return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24">
                ${App.views.adminHeader('Network Configuration')}
                <div class="p-6 space-y-8">
                    <div class="border border-green-500/30 p-6 bg-green-950/5">
                        <h3 class="text-xs mb-4 uppercase tracking-widest">Master_Server_Address</h3>
                        <p class="text-[8px] text-green-500/50 mb-4 uppercase">
                            Enter the IP address of the PC running the CLICKER server. 
                            Ensure both devices are on the same Wi-Fi.
                        </p>
                        <div class="space-y-4">
                            <input type="text" id="api-base-input" value="${App.state.apiBase}" 
                                class="w-full bg-black border border-green-500/50 p-3 text-sm outline-none focus:border-green-500" 
                                placeholder="http://192.168.1.XX:3000">
                            <button onclick="App.updateApiBase(document.getElementById('api-base-input').value)" 
                                class="w-full bg-green-500 text-black py-3 font-bold text-xs uppercase hover:bg-green-400">Save_and_Reconnect</button>
                        </div>
                    </div>

                    <div class="border border-green-500/10 p-4 bg-black/40">
                        <h3 class="text-[10px] mb-2 uppercase tracking-widest text-green-500/40">Current_Connection_Status</h3>
                        <div class="flex items-center space-x-2">
                            <div class="w-2 h-2 rounded-full ${App.state.syncStatus === 'SUCCESS' ? 'bg-green-500' : App.state.syncStatus === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}"></div>
                            <span class="text-[10px] uppercase">${App.state.syncStatus}</span>
                        </div>
                    </div>
                </div>
                ${App.views.nav()}
            </div>
            `;
        },
        adminHeader: function(title) { return `
            <header class="p-4 border-b border-green-500/30 flex items-center bg-black/90 sticky top-0 z-50">
                <button onclick="App.navigate('admin')" class="mr-4">←</button>
                <div class="flex flex-col">
                    <span class="text-xs text-green-500/40">ADMIN_PANEL</span>
                    <span class="text-lg tracking-tighter font-bold uppercase">${title}</span>
                </div>
            </header>
        `; },
        auth: function() { return `
            <div class="min-h-screen w-full bg-black p-6 font-mono flex flex-col items-center">
                <div class="mt-10 w-full max-w-sm text-center">
                    <img src="${App.state.logoDataUri}" class="w-24 h-24 mb-6 mx-auto object-contain shadow-glow rounded-xl" onerror="this.src='logo.png'">
                    <h1 class="text-green-500 text-3xl mb-2">INITIATE_SESSION</h1>
                    <p class="text-green-500/50 mb-10 text-sm">SECURE LOGIN PROTOCOL V1.0</p>
                    
                    <div class="space-y-6 text-left">
                        <div>
                            <label class="block text-green-500/70 text-xs mb-2">USER_ID</label>
                            <input type="text" id="auth-user" class="w-full bg-black border-b border-green-500 text-green-500 p-2 focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-green-500/70 text-xs mb-2">ACCESS_CREDENTIAL</label>
                            <input type="password" id="auth-pass" class="w-full bg-black border-b border-green-500 text-green-500 p-2 focus:outline-none">
                        </div>
                        <div class="pt-6">
                            <button onclick="App.handleUserAuth(document.getElementById('auth-user').value, document.getElementById('auth-pass').value)"
                                class="w-full border border-green-500 text-green-500 py-3 hover:bg-green-500/10 transition-colors">LOGIN</button>
                            <button class="w-full text-green-500/40 text-xs mt-4 hover:text-green-500 transition-all">NEW_IDENTITY?</button>
                        </div>
                    </div>
                </div>
            </div>
        `; },
        home: function(courses) { 
            const filteredCourses = App.state.activeFilter && App.state.activeFilter !== 'ALL' 
                ? courses.filter(c => {
                    if (App.state.activeFilter === 'MY_COURSES') {
                        return App.state.unlockedCourses.includes(String(c.id));
                    }
                    const provider = c.provider.toUpperCase();
                    if (App.state.activeFilter === 'DRIVE') return provider.includes('DRIVE');
                    if (App.state.activeFilter === 'YOUTUBE') return provider.includes('YOUTUBE');
                    return provider === App.state.activeFilter;
                })
                : courses;

            return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24 text-shadow-glow">
                <header class="p-4 border-b border-green-500/30 flex justify-between items-center bg-black/90 sticky top-0 z-50">
                    <div class="flex items-center space-x-2">
                        <span class="text-xl tracking-tighter font-bold uppercase tracking-widest">${App.state.activeFilter === 'MY_COURSES' ? 'My_Library' : 'Clicker_Hub'}</span>
                        <div class="w-1.5 h-1.5 rounded-full ${App.state.syncStatus === 'SUCCESS' ? 'bg-green-500' : App.state.syncStatus === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'} shadow-glow"></div>
                    </div>
                    <button onclick="App.navigate('analytics')" class="text-green-500/70">📊</button>
                </header>
                
                <main class="p-4 lg:p-8">
                    <div class="flex space-x-4 mb-8 overflow-x-auto py-2 no-scrollbar lg:justify-center">
                        ${['ALL', 'MY_COURSES', 'YOUTUBE', 'DRIVE'].map(filter => `
                            <button onclick="App.setFilter('${filter}')" 
                                class="px-6 py-2 border border-green-500 ${App.state.activeFilter === filter || (!App.state.activeFilter && filter === 'ALL') ? 'bg-green-500 text-black shadow-glow' : 'text-green-500/50 border-green-500/30'} text-[10px] lg:text-xs uppercase font-bold transition-all hover:bg-green-500/10">
                                ${filter === 'MY_COURSES' ? 'Purchased' : filter}
                            </button>
                        `).join('')}
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        ${filteredCourses.length > 0 ? filteredCourses.map(course => {
                            const isUnlocked = App.state.unlockedCourses.includes(String(course.id));
                            return `
                            <div class="border border-green-500/20 bg-green-950/5 p-3 rounded shadow-lg group hover:border-green-500/50 transition-all">
                                <div class="relative overflow-hidden mb-4 border border-green-500/30 grayscale group-hover:grayscale-0 transition-all cursor-pointer shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                                    onclick="App.showCourse('${course.id}')">
                                    <img src="${course.thumbnail}" class="w-full h-40 object-cover">
                                    ${!isUnlocked ? `
                                        <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <div class="text-red-500 text-xs font-bold uppercase tracking-widest bg-black/80 px-4 py-2 border border-red-500/50 shadow-glow">Locked_Content</div>
                                        </div>
                                    ` : `
                                        <div class="absolute inset-0 bg-green-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div class="text-green-500 text-2xl animate-pulse">▶️</div>
                                        </div>
                                    `}
                                </div>
                                <h3 class="text-lg mb-1 group-hover:text-green-400 transition-colors">${course.title}</h3>
                                <div class="flex justify-between items-center text-[10px] text-green-500/50 mb-3">
                                    <span class="border border-green-500/30 px-2 rounded tracking-widest">${course.provider.toUpperCase()}</span>
                                    <span class="font-bold ${isUnlocked ? 'text-green-500' : 'text-red-500/60'} uppercase tracking-tighter">${isUnlocked ? 'UNLOCKED' : `FEE: ₹${course.price}`}</span>
                                </div>
                                
                                ${isUnlocked ? `
                                    <button onclick="App.showCourse('${course.id}')"
                                        class="w-full bg-green-500 text-black py-2 text-sm hover:bg-green-400 transition-all font-bold tracking-widest uppercase">
                                        Watch_Now
                                    </button>
                                ` : `
                                    <button onclick="App.handlePayment('${course.id}')"
                                        class="w-full bg-red-900/20 border border-red-500/50 text-red-500 py-2 text-sm hover:bg-red-500 hover:text-black transition-all font-bold tracking-widest uppercase">
                                        Unlock_Video [₹${course.price}]
                                    </button>
                                `}
                            </div>
                        `;}).join('') : '<div class="text-center text-xs text-green-500/30 mt-20 uppercase tracking-widest">No_Content_Found</div>'}
                    </div>
                </main>
                ${App.views.nav()}
            </div>
        `; },
        courseDetails: function(course) { 
            const videoEmbed = course.youtubeId 
                ? `<div id="video-wrapper" class="relative w-full aspect-video bg-black group overflow-hidden touch-none" 
                        onmousemove="App.handlePlayerMouseMove(event)" 
                        onwheel="App.handlePlayerWheel(event)"
                        onclick="App.handlePlayerClick(event)">
                    
                    <div id="player-container" class="w-full h-full pointer-events-none"></div>
                    
                    <!-- Cursor-based Interaction Overlay -->
                    <div id="player-overlay" class="absolute inset-0 z-20 transition-opacity duration-500 opacity-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none">
                        
                        <!-- Visual Feedback Center (Play/Pause/Seek) -->
                        <div id="player-feedback" class="absolute inset-0 flex items-center justify-center text-white text-4xl font-bold opacity-0 transition-opacity pointer-events-none drop-shadow-lg"></div>

                        <!-- Seek Preview (Timeline Navigation) -->
                        <div id="seek-preview" class="absolute top-2 bg-green-500 text-black text-[8px] px-2 py-1 font-bold hidden pointer-events-none shadow-glow">00:00</div>

                        <!-- Left Side Tap Area (Backward 10s) -->
                        <div class="absolute left-0 top-0 bottom-0 w-1/4 z-30 pointer-events-auto" onclick="event.stopPropagation(); App.handleDoubleTap(event, 'Left')">
                            <div id="seek-feedback-left" class="absolute inset-0 flex items-center justify-center bg-white/5 opacity-0 transition-opacity pointer-events-none">
                                <span class="text-white text-xl font-bold">⏪</span>
                            </div>
                        </div>

                        <!-- Right Side Tap Area (Forward 10s) -->
                        <div class="absolute right-0 top-0 bottom-0 w-1/4 z-30 pointer-events-auto" onclick="event.stopPropagation(); App.handleDoubleTap(event, 'Right')">
                            <div id="seek-feedback-right" class="absolute inset-0 flex items-center justify-center bg-white/5 opacity-0 transition-opacity pointer-events-none">
                                <span class="text-white text-xl font-bold">⏩</span>
                            </div>
                        </div>

                        <!-- Fullscreen Toggle Icon (Top Right) -->
                        <button onclick="event.stopPropagation(); App.toggleFullscreen()" class="absolute top-4 right-4 z-40 p-2 bg-black/50 rounded-full border border-green-500/30 text-green-500 hover:bg-green-500 hover:text-black transition-all pointer-events-auto">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                            </svg>
                        </button>
                    </div>
                   </div>`
                : `<div class="text-center p-10 border border-green-500/20 bg-green-950/10">
                    <div class="text-6xl text-green-500 cursor-pointer animate-pulse mb-4" onclick="window.open('${course.url}', '_blank')">▶️</div>
                    <p class="text-[10px] text-green-500 uppercase tracking-widest">External_Link_Detected</p>
                    <p class="text-[8px] text-green-500/30 mt-2 truncate max-w-[200px] mx-auto">${course.url}</p>
                   </div>`;

            return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24 text-shadow-glow">
                <header class="p-4 border-b border-green-500/30 flex items-center bg-black/90">
                    <button onclick="App.navigate('home')" class="mr-4 text-green-500 hover:text-green-400">← BACK</button>
                    <span class="text-lg tracking-tighter uppercase font-bold truncate">${course.title}</span>
                </header>
                
                <div class="lg:flex lg:space-x-8 lg:p-8">
                    <div class="lg:w-2/3">
                        <div class="w-full bg-black border-b border-green-500/30 relative">
                            ${videoEmbed}
                        </div>

                        <!-- Custom Video Controls Under the Video -->
                        <div class="p-4 bg-green-950/5 border-b border-green-500/10 flex flex-col space-y-4">
                            <!-- Progress Bar for Watching -->
                            <div class="w-full bg-green-500/10 h-1 relative rounded overflow-hidden">
                                <div id="watch-progress-inner" class="absolute left-0 top-0 bottom-0 bg-green-500 transition-all duration-300 shadow-glow" 
                                     style="width: ${App.state.completedVideos[course.id] ? '100%' : (App.state.watchedDuration[course.id] / 100 || 0)}%"></div>
                            </div>

                            <div class="flex items-center justify-around w-full">
                                <button onclick="App.seek(-10)" class="text-green-500/70 hover:text-green-400 p-2">⏪ 10s</button>
                                <button onclick="App.togglePlay()" class="bg-green-500 text-black px-8 py-2 font-bold text-sm uppercase hover:bg-green-400 transition-all shadow-[0_0_15px_rgba(34,197,94,0.4)]">Play / Pause</button>
                                <button onclick="App.seek(10)" class="text-green-500/70 hover:text-green-400 p-2">10s ⏩</button>
                            </div>
                            
                            <div class="flex items-center justify-around w-full pt-2 border-t border-green-500/10">
                                <div class="flex items-center space-x-2">
                                    <label class="text-[8px] text-green-500/50 uppercase">Speed</label>
                                    <select onchange="App.setSpeed(this.value)" class="bg-black border border-green-500/30 text-green-500 text-xs p-1 outline-none">
                                        <option value="0.5" ${App.state.playbackSpeed == 0.5 ? 'selected' : ''}>0.5x</option>
                                        <option value="1" ${App.state.playbackSpeed == 1 ? 'selected' : ''}>Normal</option>
                                        <option value="1.5" ${App.state.playbackSpeed == 1.5 ? 'selected' : ''}>1.5x</option>
                                        <option value="2" ${App.state.playbackSpeed == 2 ? 'selected' : ''}>2x</option>
                                    </select>
                                </div>

                                <button onclick="App.toggleAutoplay()" class="text-[8px] border border-green-500/30 px-3 py-2 ${App.state.isAutoplay ? 'bg-green-500 text-black' : 'text-green-500/50'} uppercase font-bold tracking-widest">
                                    Autoplay: ${App.state.isAutoplay ? 'ON' : 'OFF'}
                                </button>
                            </div>
                        </div>

                        <div class="p-4 flex justify-center lg:justify-start">
                            <button id="yt-fallback-btn" onclick="window.open('${course.url}', '_blank')" 
                                class="hidden text-[8px] border border-green-500/30 px-4 py-2 hover:bg-green-500 hover:text-black transition-all uppercase font-bold tracking-widest">
                                ⚠️ Video not playing? Open in YouTube
                            </button>
                        </div>
                    </div>

                    <div class="p-6 lg:w-1/3 lg:border-l lg:border-green-500/20">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <h2 class="text-xl lg:text-2xl mb-1 font-bold text-green-400">${course.title}</h2>
                                <span class="text-[10px] border border-green-500/30 px-2 rounded-full uppercase tracking-widest text-green-500/60">${course.provider}</span>
                            </div>
                            <span class="text-[10px] text-green-500 bg-green-950 px-2 py-1 rounded">UNLOCKED_ACCESS</span>
                        </div>
                        <p class="text-green-500/60 text-sm mb-8 leading-relaxed border-l-2 border-green-500/20 pl-4">${course.description}</p>
                        
                        <div class="space-y-4">
                            <h3 class="text-xs uppercase tracking-tighter mb-4 text-green-500/40">Curriculum_Modules</h3>
                            <div class="p-4 border border-green-500/20 bg-green-950/10 flex justify-between items-center group hover:border-green-500/50 transition-all cursor-pointer">
                                <div>
                                    <h4 class="text-sm font-bold group-hover:text-green-400 transition-colors">01_CORE_PROTOCOL</h4>
                                    <span class="text-[10px] text-green-500/40 uppercase">Duration: 15:30 MIN</span>
                                </div>
                                <button class="text-[10px] border border-green-500 px-4 py-1 hover:bg-green-500 hover:text-black transition-all font-bold">PLAYING</button>
                            </div>
                        </div>
                    </div>
                </div>
                ${App.views.nav()}
            </div>
        `; },
        analytics: function() { 
            const user = App.state.currentUser || { username: 'GUEST_USER', id: 'NO_ID' };
            const unlockedCount = App.state.unlockedCourses.length;
            const totalCourses = App.state.courses.length;
            const progressPercent = totalCourses > 0 ? Math.round((unlockedCount / totalCourses) * 100) : 0;
            
            const statusColors = {
                'ACTIVE': 'text-green-500 border-green-500',
                'INACTIVE': 'text-yellow-500 border-yellow-500',
                'SUSPENDED': 'text-red-500 border-red-500'
            };

            return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24 text-shadow-glow">
                <header class="p-4 border-b border-green-500/30 flex justify-between items-center bg-black/90 sticky top-0 z-50">
                    <div class="flex items-center">
                        <button onclick="App.navigate('home')" class="mr-4 text-green-500">←</button>
                        <span class="text-lg tracking-tighter uppercase font-bold">User_Status</span>
                    </div>
                    <button onclick="App.refreshStatusData()" class="text-green-500/70 hover:text-green-400 transition-all">🔄</button>
                </header>
                
                <div class="p-6 space-y-6">
                    <!-- Monitoring Dashboard -->
                    <div class="border border-green-500/20 p-4 bg-green-950/5">
                        <h3 class="text-[10px] mb-4 uppercase tracking-widest text-green-500/40">Real_Time_Monitoring</h3>
                        <div class="grid grid-cols-3 gap-2">
                            <div class="text-center p-2 border border-green-500/10">
                                <div class="text-xl font-bold">${App.state.uploadMetrics.total}</div>
                                <div class="text-[6px] uppercase opacity-50">Uploads</div>
                            </div>
                            <div class="text-center p-2 border border-green-500/10">
                                <div class="text-xl font-bold text-green-400">${App.state.uploadMetrics.success}</div>
                                <div class="text-[6px] uppercase opacity-50">Success</div>
                            </div>
                            <div class="text-center p-2 border border-green-500/10">
                                <div class="text-xl font-bold text-red-400">${App.state.uploadMetrics.failed}</div>
                                <div class="text-[6px] uppercase opacity-50">Dropped</div>
                            </div>
                        </div>
                    </div>

                    <!-- Identity Card -->
                    <div class="border border-green-500/20 p-4 bg-green-950/5 relative overflow-hidden">
                        <div class="absolute top-0 right-0 p-2">
                            <span class="text-[8px] border px-2 py-0.5 rounded-full ${statusColors[App.state.userStatus] || 'text-gray-500'}">
                                ${App.state.userStatus}
                            </span>
                        </div>
                        <div class="text-[10px] text-green-500/50 mb-2 uppercase tracking-widest">Identity_Protocol</div>
                        <div class="text-xl font-bold text-green-400">${user.username}</div>
                        <div class="text-[8px] text-green-500/30 mt-1 uppercase tracking-tighter">UID: ${user.id}</div>
                        <div class="text-[8px] text-green-500/20 mt-4 uppercase">Last_Update: ${new Date(App.state.lastStatusUpdate).toLocaleString()}</div>
                    </div>

                    <!-- Progress Metrics -->
                    <div class="grid grid-cols-2 gap-4">
                        <div class="border border-green-500/30 p-4 text-center bg-green-950/5">
                            <div class="text-3xl font-bold text-green-400">${progressPercent}%</div>
                            <div class="text-[8px] text-green-500/50 mt-1 uppercase">Course_Unlock_Ratio</div>
                        </div>
                        <div class="border border-green-500/30 p-4 text-center bg-green-950/5">
                            <div class="text-3xl font-bold text-green-400">${Object.keys(App.state.completedVideos).length}</div>
                            <div class="text-[8px] text-green-500/50 mt-1 uppercase">Classes_Fully_Watched</div>
                        </div>
                    </div>

                    <!-- Watch History -->
                    ${Object.keys(App.state.completedVideos).length > 0 ? `
                        <div class="border border-green-500/20 p-4 bg-green-950/5">
                            <h3 class="text-xs mb-4 uppercase tracking-widest">Completion_Logs</h3>
                            <div class="space-y-2">
                                ${Object.entries(App.state.completedVideos).map(([id, time]) => {
                                    const course = App.state.courses.find(c => String(c.id) === String(id));
                                    return `
                                        <div class="flex justify-between items-center text-[8px] border-b border-green-500/10 pb-1">
                                            <span class="text-green-400">${course ? course.title : 'Unknown_Asset'}</span>
                                            <span class="text-green-500/30">${new Date(time).toLocaleDateString()}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Status Controls (Verification Only) -->
                    <div class="border border-green-500/10 p-4 bg-black/40">
                        <h3 class="text-[10px] mb-4 uppercase tracking-widest text-green-500/40">System_Override_Simulator</h3>
                        <div class="flex space-x-2">
                            <button onclick="App.updateUserStatus('ACTIVE')" class="flex-1 text-[8px] border border-green-500/30 py-2 hover:bg-green-500 hover:text-black transition-all">SET_ACTIVE</button>
                            <button onclick="App.updateUserStatus('INACTIVE')" class="flex-1 text-[8px] border border-yellow-500/30 py-2 hover:bg-yellow-500 hover:text-black transition-all">SET_INACTIVE</button>
                            <button onclick="App.updateUserStatus('SUSPENDED')" class="flex-1 text-[8px] border border-red-500/30 py-2 hover:bg-red-500 hover:text-black transition-all">SET_SUSPENDED</button>
                        </div>
                    </div>

                    <!-- Network Engagement Graph -->
                    <div class="border border-green-500/20 p-4 bg-green-950/5">
                        <h3 class="text-xs mb-4 uppercase tracking-widest">Network_Engagement</h3>
                        <div class="h-32 flex items-end space-x-2">
                            ${[60, 80, 40, 90, 70, 50, 85].map(h => `
                                <div class="bg-green-500/40 w-full hover:bg-green-500 transition-all cursor-crosshair group relative" style="height: ${h}%">
                                    <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-500 text-black text-[8px] px-1 opacity-0 group-hover:opacity-100 transition-opacity">${h}%</div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="flex justify-between text-[8px] text-green-500/30 mt-2">
                            <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
                        </div>
                    </div>

                    <!-- Compliance & Legal -->
                    <div class="pt-4 flex justify-center space-x-6">
                        <button onclick="App.navigate('legal')" class="text-[8px] text-green-500/40 hover:text-green-500 underline uppercase tracking-widest">Privacy_Protocol</button>
                        <button onclick="App.navigate('legal')" class="text-[8px] text-green-500/40 hover:text-green-500 underline uppercase tracking-widest">Terms_of_Service</button>
                    </div>
                </div>
                ${App.views.nav()}
            </div>
        `; },
        chat: function() {
            return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24 flex flex-col">
                <header class="p-4 border-b border-green-500/30 flex items-center bg-black/90 sticky top-0 z-50">
                    <button onclick="App.navigate('home')" class="mr-4 text-green-500">←</button>
                    <span class="text-lg tracking-tighter uppercase font-bold">Community_Portal</span>
                </header>
                
                <main class="flex-1 p-6 flex flex-col items-center justify-center text-center">
                    <div class="mb-10 relative">
                        <div class="w-32 h-32 border-2 border-green-500 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                            <span class="text-5xl">💬</span>
                        </div>
                        <div class="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] px-2 py-1 font-bold rounded">SECURE</div>
                    </div>

                    <div class="space-y-6 max-w-xs mb-10">
                        <h2 class="text-xl font-bold uppercase tracking-tighter text-shadow-glow">In_App_Secure_Link</h2>
                        <p class="text-[10px] text-green-500/50 leading-relaxed uppercase tracking-widest">
                            Telegram security protocols block standard frames. Click below to launch the secure portal directly.
                        </p>
                    </div>

                    <button onclick="App.openCommunityChat()" 
                        class="w-full bg-green-500 text-black py-4 font-bold uppercase tracking-widest hover:bg-green-400 transition-all shadow-[0_0_25px_rgba(34,197,94,0.4)] flex items-center justify-center space-x-2">
                        <span>🚀</span>
                        <span>Launch_Community_Chat</span>
                    </button>

                    <div class="mt-8 pt-8 border-t border-green-500/10 w-full space-y-4">
                        <p class="text-[7px] text-green-500/30 uppercase tracking-tighter">Connection: Telegram_Web_Core_V2</p>
                        <div class="flex justify-center space-x-4">
                            <button onclick="window.open('https://t.me/+w1ZScncyMOFkNzY1', '_blank')" class="text-[8px] text-green-500/40 hover:text-green-500 underline uppercase">Direct_Link</button>
                            <span class="text-green-500/10">|</span>
                            <button onclick="window.open('https://web.telegram.org/k/', '_blank')" class="text-[8px] text-green-500/40 hover:text-green-500 underline uppercase">Telegram_Web</button>
                        </div>
                    </div>
                </main>

                ${App.views.nav()}
            </div>
        `; },
        legal: function() {
            return `
            <div class="min-h-screen bg-black font-mono text-green-500 pb-24">
                <header class="p-4 border-b border-green-500/30 flex items-center bg-black/90 sticky top-0 z-50">
                    <button onclick="App.navigate('home')" class="mr-4 text-green-500">←</button>
                    <span class="text-lg tracking-tighter uppercase font-bold">Legal_Protocol</span>
                </header>
                
                <div class="p-6 space-y-8 overflow-y-auto h-[calc(100vh-160px)] no-scrollbar">
                    <section>
                        <h3 class="text-xs text-green-500/50 mb-2 uppercase tracking-widest">Privacy_Policy</h3>
                        <p class="text-[10px] leading-relaxed opacity-80 uppercase">
                            We value your data security. CLICKER operates on a decentralized, local-first architecture. 
                            Your personal progress, unlocked keys, and session data are stored exclusively in your 
                            device's local storage. We do not transmit or sell your information to third-party entities.
                        </p>
                    </section>

                    <section>
                        <h3 class="text-xs text-green-500/50 mb-2 uppercase tracking-widest">Terms_of_Service</h3>
                        <p class="text-[10px] leading-relaxed opacity-80 uppercase">
                            By using this application, you agree to:
                            1. Access only content you have legitimate keys for.
                            2. Not attempt to bypass the Interaction Shield or DRM mechanisms.
                            3. Use the platform for educational purposes only.
                        </p>
                    </section>

                    <div class="pt-8 border-t border-green-500/10 text-center">
                        <p class="text-[8px] text-green-500/30">VERSION: 1.0.0-PROD</p>
                        <p class="text-[8px] text-green-500/30 mt-1">ENCRYPTION: AES-256 (SIMULATED)</p>
                    </div>
                </div>
                ${App.views.nav()}
            </div>
        `; },
        nav: function() { return `
            <nav class="fixed bottom-0 left-0 right-0 bg-black border-t border-green-500/30 p-4 flex justify-around items-center z-50 lg:max-w-6xl lg:mx-auto lg:border-x">
                <button onclick="App.navigate('home')" class="text-green-500 hover:text-green-400 transition-all flex flex-col items-center group">
                    <span class="text-xl group-hover:scale-110 transition-transform">🏠</span>
                    <span class="text-[8px] mt-1 uppercase opacity-50 group-hover:opacity-100">Home</span>
                </button>
                <button onclick="App.navigate('home'); App.setFilter('MY_COURSES');" class="text-green-500/40 hover:text-green-500 transition-all flex flex-col items-center group">
                    <span class="text-xl group-hover:scale-110 transition-transform">📚</span>
                    <span class="text-[8px] mt-1 uppercase opacity-50 group-hover:opacity-100">Courses</span>
                </button>
                <button onclick="App.navigate('analytics')" class="text-green-500/40 hover:text-green-500 transition-all flex flex-col items-center group">
                    <span class="text-xl group-hover:scale-110 transition-transform">📊</span>
                    <span class="text-[8px] mt-1 uppercase opacity-50 group-hover:opacity-100">Stats</span>
                </button>
                <button onclick="App.navigate('chat')" class="text-green-500/40 hover:text-green-500 transition-all flex flex-col items-center group">
                    <span class="text-xl group-hover:scale-110 transition-transform">💬</span>
                    <span class="text-[8px] mt-1 uppercase opacity-50 group-hover:opacity-100">Chat</span>
                </button>
            </nav>
        `; }
    },

    showCourse(id) {
        const course = this.state.courses.find(c => String(c.id) === String(id));
        if (!course) return alert('SYSTEM_ERROR: COURSE_NOT_FOUND');

        // SECURITY: Check if course is unlocked before showing
        if (!this.state.unlockedCourses.includes(String(id))) {
            console.log('Course not unlocked, triggering payment flow...');
            return this.handlePayment(id);
        }

        // Extract YouTube ID for the player
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = course.url.match(regExp);
        course.youtubeId = (match && match[7].length == 11) ? match[7] : null;
        
        this.state.selectedCourse = course;
        this.navigate('course-details');

        // Initialize YouTube Player after a short delay to ensure the container is rendered
        setTimeout(() => this.initPlayer(course.youtubeId), 100);
    },

    initPlayer(ytId) {
        if (!ytId || !window.YT) return;
        
        // Destroy existing player and clear tracking interval
        if (this.state.ytPlayer) {
            try { this.state.ytPlayer.destroy(); } catch(e) {}
        }
        if (this.state.trackingInterval) clearInterval(this.state.trackingInterval);

        this.state.ytPlayer = new YT.Player('player-container', {
            videoId: ytId,
            playerVars: {
                'autoplay': this.state.isAutoplay ? 1 : 0,
                'controls': 0, // Disable native controls
                'modestbranding': 1,
                'rel': 0,
                'showinfo': 0,
                'iv_load_policy': 3,
                'disablekb': 1, // Disable keyboard
                'origin': window.location.origin
            },
            events: {
                'onReady': (event) => {
                    console.log('Player Ready');
                    event.target.setPlaybackRate(this.state.playbackSpeed);
                    event.target.setVolume(this.state.playerVolume);
                    this.startTracking();
                    this.setupKeyboardShortcuts();
                },
                'onStateChange': (event) => {
                    if (event.data === YT.PlayerState.PLAYING) {
                        this.state.lastTickTime = event.target.getCurrentTime();
                    }
                },
                'onError': (event) => {
                    console.error('YouTube Player Error:', event.data);
                    const fallbackBtn = document.getElementById('yt-fallback-btn');
                    if (fallbackBtn) fallbackBtn.classList.remove('hidden');
                }
            }
        });
    },

    handlePlayerClick(e) {
        // Prevent click from bubbling if it was a control button
        if (e.target.closest('button') || e.target.closest('select')) return;
        this.togglePlay();
        this.showPlayerFeedback(this.state.ytPlayer.getPlayerState() === YT.PlayerState.PLAYING ? '⏸️ PAUSE' : '▶️ PLAY');
    },

    handlePlayerMouseMove(e) {
        this.state.controlsVisible = true;
        const overlay = document.getElementById('player-overlay');
        if (overlay) overlay.classList.remove('opacity-0');
        
        // Horizontal Seek Preview (Timeline Navigation)
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        const seekPreview = document.getElementById('seek-preview');
        if (seekPreview && this.state.ytPlayer && this.state.ytPlayer.getDuration) {
            const duration = this.state.ytPlayer.getDuration();
            const seekTime = duration * percent;
            seekPreview.style.left = `${x}px`;
            seekPreview.innerText = this.formatTime(seekTime);
            seekPreview.classList.remove('hidden');
        }

        // Auto-hide logic
        if (this.state.hideTimeout) clearTimeout(this.state.hideTimeout);
        this.state.hideTimeout = setTimeout(() => {
            this.state.controlsVisible = false;
            if (overlay) overlay.classList.add('opacity-0');
            if (seekPreview) seekPreview.classList.add('hidden');
        }, 3000);
    },

    handlePlayerWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -5 : 5;
        this.updateVolume(this.state.playerVolume + delta);
    },

    updateVolume(newVol) {
        this.state.playerVolume = Math.max(0, Math.min(100, newVol));
        if (this.state.ytPlayer && this.state.ytPlayer.setVolume) {
            this.state.ytPlayer.setVolume(this.state.playerVolume);
            this.showPlayerFeedback(`🔊 ${this.state.playerVolume}%`);
        }
    },

    showPlayerFeedback(text) {
        const feedback = document.getElementById('player-feedback');
        if (feedback) {
            feedback.innerText = text;
            feedback.classList.remove('opacity-0');
            feedback.classList.add('opacity-100');
            setTimeout(() => {
                feedback.classList.remove('opacity-100');
                feedback.classList.add('opacity-0');
            }, 1000);
        }
    },

    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [h, m, s].map(v => v.toString().padStart(2, '0')).filter((v, i) => v !== '00' || i > 0).join(':');
    },

    setupKeyboardShortcuts() {
        this.removeKeyboardShortcuts(); // Prevent duplicates
        this._kbHandler = (e) => {
            if (this.state.currentView !== 'course-details') return;
            
            switch(e.code) {
                case 'Space':
                    e.preventDefault();
                    this.togglePlay();
                    break;
                case 'ArrowLeft':
                    this.seek(-10);
                    this.showPlayerFeedback('⏪ 10s');
                    break;
                case 'ArrowRight':
                    this.seek(10);
                    this.showPlayerFeedback('10s ⏩');
                    break;
                case 'ArrowUp':
                    this.updateVolume(this.state.playerVolume + 5);
                    break;
                case 'ArrowDown':
                    this.updateVolume(this.state.playerVolume - 5);
                    break;
                case 'KeyM':
                    this.state.isMuted = !this.state.isMuted;
                    if (this.state.ytPlayer) {
                        if (this.state.isMuted) this.state.ytPlayer.mute();
                        else this.state.ytPlayer.unMute();
                    }
                    this.showPlayerFeedback(this.state.isMuted ? '🔇 MUTED' : '🔊 UNMUTED');
                    break;
                case 'KeyF':
                    this.toggleFullscreen();
                    break;
            }
        };
        window.addEventListener('keydown', this._kbHandler);
    },

    removeKeyboardShortcuts() {
        if (this._kbHandler) {
            window.removeEventListener('keydown', this._kbHandler);
            this._kbHandler = null;
        }
    },

    startTracking() {
        const videoId = this.state.selectedCourse.id;
        if (this.state.completedVideos[videoId]) {
            console.log('Video already completed');
            return;
        }

        this.state.trackingInterval = setInterval(() => {
            if (!this.state.ytPlayer || !this.state.ytPlayer.getCurrentTime) return;
            
            const playerState = this.state.ytPlayer.getPlayerState();
            if (playerState !== YT.PlayerState.PLAYING) return;

            const currentTime = this.state.ytPlayer.getCurrentTime();
            const duration = this.state.ytPlayer.getDuration();
            
            if (!duration) return;

            // ANTI-SKIP SAFEGUARD: If they jump more than 2 seconds between 1-second ticks
            const timeDiff = currentTime - (this.state.lastTickTime || 0);
            if (timeDiff > 2) {
                console.warn('Scrubbing detected, resetting tick reference');
                this.state.lastTickTime = currentTime;
                return; // Don't count this second
            }

            // Increment watched seconds
            this.state.watchedDuration[videoId] = (this.state.watchedDuration[videoId] || 0) + 1;
            this.state.lastTickTime = currentTime;

            // Check for 95% completion
            const targetSeconds = duration * 0.95;
            if (this.state.watchedDuration[videoId] >= targetSeconds) {
                this.markVideoComplete(videoId);
            }

            // Real-time UI update for progress if visible
            const progBar = document.getElementById('watch-progress-inner');
            if (progBar) {
                const percent = Math.min(100, (this.state.watchedDuration[videoId] / targetSeconds) * 100);
                progBar.style.width = `${percent}%`;
            }
        }, 1000);
    },

    markVideoComplete(videoId) {
        if (this.state.completedVideos[videoId]) return;
        
        clearInterval(this.state.trackingInterval);
        this.state.completedVideos[videoId] = new Date().toISOString();
        this.saveWatchStats();
        
        // Visual Feedback
        alert('SYSTEM_UPDATE: VIDEO_WATCH_STATUS_COMPLETE. Status Incrementing...');
        this.render(); // Refresh to show completed state
    },

    togglePlay() {
        if (!this.state.ytPlayer) return;
        const state = this.state.ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
            this.state.ytPlayer.pauseVideo();
        } else {
            this.state.ytPlayer.playVideo();
        }
    },

    setSpeed(speed) {
        this.state.playbackSpeed = parseFloat(speed);
        if (this.state.ytPlayer && this.state.ytPlayer.setPlaybackRate) {
            this.state.ytPlayer.setPlaybackRate(this.state.playbackSpeed);
        }
    },

    seek(seconds) {
        if (!this.state.ytPlayer || !this.state.ytPlayer.getCurrentTime) return;
        const currentTime = this.state.ytPlayer.getCurrentTime();
        this.state.ytPlayer.seekTo(currentTime + seconds, true);
    },

    toggleAutoplay() {
        this.state.isAutoplay = !this.state.isAutoplay;
        App.render();
    },

    handleDoubleTap(e, side) {
        const now = Date.now();
        const lastTap = this.state[`lastTap${side}`] || 0;
        if (now - lastTap < 300) {
            // Double tap detected
            this.seek(side === 'Left' ? -10 : 10);
            
            // Show visual feedback
            const feedback = document.getElementById(`seek-feedback-${side.toLowerCase()}`);
            if (feedback) {
                feedback.classList.remove('opacity-0');
                feedback.classList.add('opacity-100');
                setTimeout(() => {
                    feedback.classList.remove('opacity-100');
                    feedback.classList.add('opacity-0');
                }, 500);
            }
        }
        this.state[`lastTap${side}`] = now;
    },

    openCommunityChat() {
        const url = 'https://web.telegram.org/k/#@clickerpublicchat';
        const width = 450;
        const height = 750;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        
        window.open(url, 'TelegramCommunityChat', 
            `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`
        );
    },

    toggleFullscreen() {
        const container = document.getElementById('video-wrapper');
        if (!container) return;

        if (!document.fullscreenElement) {
            if (container.requestFullscreen) {
                container.requestFullscreen();
            } else if (container.webkitRequestFullscreen) {
                container.webkitRequestFullscreen();
            } else if (container.msRequestFullscreen) {
                container.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
