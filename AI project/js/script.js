document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const filePages = document.getElementById('filePages');
    const pdfPreview = document.getElementById('pdfPreview');
    const chatMessages = document.getElementById('chatMessages');
    const questionInput = document.getElementById('questionInput');
    const sendBtn = document.getElementById('sendBtn');
    const documentsContainer = document.getElementById('documentsContainer');
    const activeDocumentName = document.getElementById('activeDocumentName');
    
    // API endpoint configuration
    const API_BASE_URL = 'http://localhost:8000'; // Change this to your actual API URL
    
    let uploadedFiles = [];
    let activeFileIndex = -1;
    let processingStatus = 'idle';
    
    // Handle file selection via button
    fileInput.addEventListener('change', handleFileSelect);
    
    // Handle drag and drop
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });
    
    dropZone.addEventListener('dragleave', function() {
        dropZone.classList.remove('drag-active');
    });
    
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });
    
    dropZone.addEventListener('click', function() {
        fileInput.click();
    });
    
    // Handle sending questions
    sendBtn.addEventListener('click', sendQuestion);
    questionInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendQuestion();
        }
    });
    

    
    function handleFileSelect(e) {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    }
    
    function handleFiles(files) {
        // Get API key (assuming there's an input for it)

        
        let validFiles = 0;
        let filesToUpload = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (file.type !== 'application/pdf') {
                alert(`File "${file.name}" is not a PDF and will be skipped.`);
                continue;
            }
            
            if (file.size > 10 * 1024 * 1024) {
                alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
                continue;
            }
            
            // Check if file with same name already exists
            const fileExists = uploadedFiles.some(f => f.name === file.name);
            if (fileExists) {
                alert(`File "${file.name}" is already uploaded.`);
                continue;
            }
            
            validFiles++;
            filesToUpload.push(file);
        }
        
        if (validFiles > 0) {
            // Add system message about uploading
            addMessage('system', `Uploading ${validFiles} document(s). Please wait...`);
            
            // Upload files to the backend
            uploadFiles(filesToUpload)
                .then(response => {
                    // Add files to local array
                    uploadedFiles = [...uploadedFiles, ...filesToUpload];
                    updateDocumentsList();
                    
                    // If this is the first file, make it active
                    if (uploadedFiles.length === validFiles) {
                        setActiveFile(0);
                    }
                    
                    // Start polling for processing status
                    startProcessingStatusPolling();
                    
                    addMessage('system', `Started processing ${validFiles} document(s). This may take a minute...`);
                })
                .catch(error => {
                    console.error('Error uploading files:', error);
                    addMessage('system', `Error uploading files: ${error.message || 'Unknown error'}`);
                });
        }
    }
    
    function uploadFiles(files) {
        // Create FormData object to send files
        const formData = new FormData();
        
        // Add API key

        
        // Add files
        files.forEach(file => {
            formData.append('files', file);
        });
        
        // Send request to the backend
        return fetch(`${API_BASE_URL}/upload-pdfs/`, {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.detail || 'Error uploading files');
                });
            }
            return response.json();
        });
    }
    
    function startProcessingStatusPolling() {
        // Set processing status
        processingStatus = 'processing';
        
        // Start polling
        const pollInterval = setInterval(() => {
            fetch(`${API_BASE_URL}/processing-status/`)
                .then(response => response.json())
                .then(data => {
                    // Update status
                    processingStatus = data.status;
                    
                    if (processingStatus === 'completed') {
                        // Stop polling
                        clearInterval(pollInterval);
                        
                        // Enable chat if not already enabled
                        questionInput.disabled = false;
                        sendBtn.disabled = false;
                        
                        // Add message
                        addMessage('system', 'Processing complete! You can now ask questions about the documents.');
                    } else if (processingStatus === 'failed') {
                        // Stop polling
                        clearInterval(pollInterval);
                        
                        // Add error message
                        addMessage('system', `Processing failed: ${data.message}`);
                    }
                })
                .catch(error => {
                    console.error('Error checking processing status:', error);
                });
        }, 3000); // Check every 3 seconds
    }
    
    function updateDocumentsList() {
        // Clear the "No documents" message if present
        const noDocsMessage = documentsContainer.querySelector('.no-documents');
        if (noDocsMessage) {
            documentsContainer.removeChild(noDocsMessage);
        }
        
        // Clear existing document cards
        documentsContainer.innerHTML = '';
        
        // Add document cards for each file
        uploadedFiles.forEach((file, index) => {
            const docCard = document.createElement('div');
            docCard.className = `document-card ${index === activeFileIndex ? 'active' : ''}`;
            docCard.dataset.index = index;
            
            // Use actual file size
            const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
            
            docCard.innerHTML = `
                <h3>${file.name}</h3>
                <p>${fileSizeMB} MB</p>
                <button class="remove-btn" data-index="${index}"><i class="fas fa-times"></i></button>
            `;
            
            // Add click event to make this document active
            docCard.addEventListener('click', function(e) {
                // Don't trigger if clicking the remove button
                if (e.target.closest('.remove-btn')) return;
                
                setActiveFile(parseInt(this.dataset.index));
            });
            
            documentsContainer.appendChild(docCard);
        });
        
        // Add remove button event listeners
        const removeButtons = document.querySelectorAll('.remove-btn');
        removeButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const index = parseInt(this.dataset.index);
                removeFile(index);
            });
        });
        
        // If no files, show "No documents" message
        if (uploadedFiles.length === 0) {
            const noDocsMessage = document.createElement('p');
            noDocsMessage.className = 'no-documents';
            noDocsMessage.textContent = 'No documents uploaded yet';
            documentsContainer.appendChild(noDocsMessage);
            
            // Reset preview and disable chat
            pdfPreview.innerHTML = '<span>PDF preview will appear here</span>';
            fileName.textContent = 'No file selected';
            filePages.textContent = '0 pages';
            activeDocumentName.textContent = 'None';
            questionInput.disabled = true;
            sendBtn.disabled = true;
            activeFileIndex = -1;
        }
    }
    
    function setActiveFile(index) {
        if (index < 0 || index >= uploadedFiles.length) return;
        
        activeFileIndex = index;
        const file = uploadedFiles[index];
        
        // Update UI
        fileName.textContent = file.name;
        
        // Create PDF preview
        const fileURL = URL.createObjectURL(file);
        pdfPreview.innerHTML = `<iframe src="${fileURL}" width="100%" height="100%"></iframe>`;
        
        // Update active document name
        activeDocumentName.textContent = file.name;
        
        // Update file size instead of page count (since we don't have actual page count)
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        filePages.textContent = `${fileSizeMB} MB`;
        
        // Update active class on document cards
        const docCards = document.querySelectorAll('.document-card');
        docCards.forEach(card => {
            if (parseInt(card.dataset.index) === index) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }
    
    function removeFile(index) {
        if (index < 0 || index >= uploadedFiles.length) return;
        
        const fileName = uploadedFiles[index].name;
        
        // Remove the file from the array
        uploadedFiles.splice(index, 1);
        
        // Update the documents list
        updateDocumentsList();
        
        // If the active file was removed, set a new active file
        if (index === activeFileIndex) {
            if (uploadedFiles.length > 0) {
                // Set the first file as active
                setActiveFile(0);
            } else {
                // No files left
                activeFileIndex = -1;
            }
        } else if (index < activeFileIndex && activeFileIndex > 0) {
            // If a file before the active one was removed, adjust the active index
            activeFileIndex--;
        }
        
        // Add a system message
        addMessage('system', `Removed document "${fileName}". Note: The document is still processed on the server.`);
    }
    
    async function sendQuestion() {
        const question = questionInput.value.trim();
        
        if (!question) return;
        
        // Check if processing is completed
        if (processingStatus !== 'completed') {
            addMessage('system', 'Please wait for document processing to complete before asking questions.');
            return;
        }
        
        // Get API key

        

        
        // Add user message
        addMessage('user', question);
        
        // Clear input
        questionInput.value = '';
        
        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'message ai typing';
        typingIndicator.innerHTML = `
            <div class="message-content">
                <p>Analyzing documents...</p>
            </div>
        `;
        chatMessages.appendChild(typingIndicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            // Create form data
            const formData = new FormData();
            formData.append('question', question);

            
            // Send question to backend
            const response = await fetch(`${API_BASE_URL}/ask-question/`, {
                method: 'POST',
                body: formData
            });
            
            // Remove typing indicator
            chatMessages.removeChild(typingIndicator);
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Error getting answer');
            }
            
            const data = await response.json();
            
            // Add AI response
            addMessage('ai', data.answer);
            
        } catch (error) {
            // Remove typing indicator if it still exists
            if (chatMessages.contains(typingIndicator)) {
                chatMessages.removeChild(typingIndicator);
            }
            
            console.error('Error asking question:', error);
            addMessage('system', `Error: ${error.message || 'Failed to get answer'}`);
        }
    }
    
    function addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        const paragraph = document.createElement('p');
        paragraph.textContent = content;
        
        contentDiv.appendChild(paragraph);
        messageDiv.appendChild(contentDiv);
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    

});
