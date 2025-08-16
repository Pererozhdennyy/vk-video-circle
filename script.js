document.addEventListener('DOMContentLoaded', function() {
    const authBtn = document.getElementById('auth-btn');
    const tokenInput = document.getElementById('token');
    const mainSection = document.querySelector('.main-section');
    const conversationsList = document.getElementById('conversations-list');
    const videoFileInput = document.getElementById('video-file');
    const shapeIdSelect = document.getElementById('shape-id');
    const sendBtn = document.getElementById('send-btn');
    const statusDiv = document.getElementById('status');
    const authStatusDiv = document.getElementById('auth-status');
    const themeToggle = document.getElementById('theme-toggle');
    const loadMoreBtn = document.getElementById('load-more');
    const fileNameSpan = document.getElementById('file-name');
    const videoStatusDiv = document.getElementById('video-status');
    const fileLabel = document.querySelector('.file-label');

    let selectedConversation = null;
    let vkToken = '';
    const VK_API_VERSION = '5.201';
    let currentOffset = 0;
    let isLoading = false;
    let profiles = {};
    let groups = {};

    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');
        document.body.classList.toggle('light-theme');

        const icon = themeToggle.querySelector('i');
        if (document.body.classList.contains('dark-theme')) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    });

    authBtn.addEventListener('click', async function() {
        vkToken = tokenInput.value.trim();
        if (!vkToken) {
            showAuthStatus('Пожалуйста, введите токен VK', 'error');
            return;
        }

        showAuthStatus('Проверка токена...', '');
        authBtn.disabled = true;

        try {
            const response = await fetch(`/api/users.get?access_token=${vkToken}&v=${VK_API_VERSION}`);
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.error_msg);
            }
            const user = data.response[0];
            showAuthStatus(`Авторизация успешна: ${user.first_name} ${user.last_name}`, 'success');
            mainSection.classList.remove('hidden');
            await getConversations();
        } catch (error) {
            showAuthStatus(`Ошибка авторизации: ${error.message}`, 'error');
            console.error(error);
        } finally {
            authBtn.disabled = false;
        }
    });

    function showAuthStatus(message, type) {
        authStatusDiv.textContent = message;
        authStatusDiv.className = type || '';
    }

    async function getConversations(loadMore = false) {
        if (isLoading) return;
        isLoading = true;

        try {
            if (!loadMore) {
                currentOffset = 0;
                conversationsList.innerHTML = '<div class="loader"></div>';
            } else {
                loadMoreBtn.disabled = true;
                loadMoreBtn.textContent = 'Загрузка...';
            }

            const response = await fetch(`/api/messages.getConversations?access_token=${vkToken}&v=${VK_API_VERSION}&count=10&offset=${currentOffset}`);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.error_msg);
            }

            const userIds = [];
            const groupIds = [];

            data.response.items.forEach(item => {
                if (item.conversation.peer.type === 'user') {
                    userIds.push(item.conversation.peer.id);
                } else if (item.conversation.peer.type === 'chat') {
                    // Для чатов получаем информацию об отправителе последнего сообщения
                    if (item.last_message.from_id > 0) {
                        userIds.push(item.last_message.from_id);
                    }
                } else if (item.conversation.peer.type === 'group') {
                    groupIds.push(-item.conversation.peer.id);
                }
            });

            if (userIds.length > 0) {
                const profilesResponse = await fetch(`/api/users.get?access_token=${vkToken}&v=${VK_API_VERSION}&user_ids=${userIds.join(',')}&fields=photo_100`);
                const profilesData = await profilesResponse.json();

                if (profilesData.response) {
                    profilesData.response.forEach(user => {
                        profiles[user.id] = user;
                    });
                }
            }

            if (groupIds.length > 0) {
    try {
        const groupsResponse = await fetch(`/api/groups.getById?access_token=${vkToken}&v=${VK_API_VERSION}&group_ids=${groupIds.join(',')}`);
        const groupsData = await groupsResponse.json();

        if (groupsData.error) {
            console.error('Ошибка при получении информации о группах:', groupsData.error);
            } else if (groupsData.response) {
                const groupsArray = Array.isArray(groupsData.response) ? groupsData.response : [groupsData.response];
                groupsArray.forEach(group => {
                    groups[-group.id] = group;
                });
            }
                } catch (error) {
                    console.error('Ошибка при запросе информации о группах:', error);
                }
        }

            if (!loadMore) {
                conversationsList.innerHTML = '';
            }

            data.response.items.forEach(item => {
                const conversation = document.createElement('div');
                conversation.className = 'conversation';
                conversation.dataset.peerId = item.conversation.peer.id;

                let title = '';
                let avatar = '';

                if (item.conversation.peer.type === 'user') {
                    const user = profiles[item.conversation.peer.id] || {};
                    title = `${user.first_name || ''} ${user.last_name || ''}`.trim() || `Пользователь ${item.conversation.peer.id}`;
                    avatar = user.photo_100 || 'https://vk.com/images/camera_100.png';
                } else if (item.conversation.peer.type === 'chat') {
                    title = item.conversation.chat_settings?.title || `Чат ${item.conversation.peer.id}`;
                    avatar = item.conversation.chat_settings?.photo?.photo_100 || 'https://vk.com/images/camera_100.png';
                } else if (item.conversation.peer.type === 'group') {
                    const group = groups[-item.conversation.peer.id] || {};
                    title = group.name || `Группа ${-item.conversation.peer.id}`;
                    avatar = group.photo_100 || 'https://vk.com/images/camera_100.png';
                } else {
                    title = `Диалог ${item.conversation.peer.id}`;
                    avatar = 'https://vk.com/images/camera_100.png';
                }

                conversation.innerHTML = `
                    <img src="${avatar}" alt="Аватар" class="conversation-avatar">
                    <div class="conversation-info">
                        <div class="conversation-name">${title}</div>
                        <div class="conversation-last-message">${item.last_message.text || ''}</div>
                    </div>
                `;

                conversation.addEventListener('click', function() {
                    document.querySelectorAll('.conversation').forEach(c => c.classList.remove('selected'));
                    this.classList.add('selected');
                    selectedConversation = this.dataset.peerId;
                });

                conversationsList.appendChild(conversation);
            });

            currentOffset += data.response.items.length;

            if (data.response.count > currentOffset) {
                loadMoreBtn.classList.remove('hidden');
                loadMoreBtn.disabled = false;
                loadMoreBtn.textContent = 'Загрузить еще';
            } else {
                loadMoreBtn.classList.add('hidden');
            }

        } catch (error) {
            statusDiv.textContent = `Ошибка: ${error.message}`;
            statusDiv.className = 'error';
            console.error(error);

            if (!loadMore) {
                conversationsList.innerHTML = '';
            }
        } finally {
            isLoading = false;
        }
    }

    loadMoreBtn.addEventListener('click', function() {
        getConversations(true);
    });

    // Обработка выбора файла
    videoFileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            fileNameSpan.textContent = this.files[0].name;
            videoStatusDiv.style.display = 'flex'; // Показываем статус
            fileLabel.style.backgroundColor = 'var(--success-color)';
            fileLabel.style.color = '#3c763d';
        } else {
            videoStatusDiv.style.display = 'none'; // Скрываем статус
            fileNameSpan.textContent = 'Выберите видео файл';
            fileLabel.style.backgroundColor = 'var(--primary-color)';
            fileLabel.style.color = 'white';
        }
    });

    sendBtn.addEventListener('click', async function() {
        if (!selectedConversation) {
            statusDiv.textContent = 'Выберите диалог для отправки';
            statusDiv.className = 'error';
            return;
        }

        const file = videoFileInput.files[0];
        if (!file) {
            statusDiv.textContent = 'Выберите видео файл';
            statusDiv.className = 'error';
            return;
        }

        const shapeId = shapeIdSelect.value;

        try {
            statusDiv.textContent = 'Отправка видео...';
            statusDiv.className = '';
            sendBtn.disabled = true;

            const uploadInfoResponse = await fetch(`/api/video.getVideoMessageUploadInfo?access_token=${vkToken}&v=${VK_API_VERSION}&shape_id=${shapeId}`);
            const uploadInfo = await uploadInfoResponse.json();

            if (uploadInfo.error) {
                throw new Error(uploadInfo.error.error_msg);
            }

            const uploadUrl = uploadInfo.response.upload_url;

            const formData = new FormData();
            formData.append('video_file', file);

            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });
            const uploadResult = await uploadResponse.json();

            if (uploadResult.error) {
                throw new Error(uploadResult.error);
            }

            const sendResponse = await fetch(`/api/messages.send?access_token=${vkToken}&v=${VK_API_VERSION}&peer_id=${selectedConversation}&random_id=0&attachment=video_message${uploadResult.owner_id}_${uploadResult.video_id}`);
            const sendResult = await sendResponse.json();

            if (sendResult.error) {
                throw new Error(sendResult.error.error_msg);
            }

            statusDiv.textContent = 'Видео-сообщение успешно отправлено!';
            statusDiv.className = 'success';

        } catch (error) {
            statusDiv.textContent = `Ошибка: ${error.message}`;
            statusDiv.className = 'error';
            console.error(error);
        } finally {
            sendBtn.disabled = false;
        }
    });
});
