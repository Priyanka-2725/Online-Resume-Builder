// Resume Builder JavaScript
class ResumeBuilder {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 5;
        this.resumeData = {
            title: '',
            personalInfo: {
                fullName: '',
                email: '',
                phone: '',
                address: '',
                linkedIn: '',
                website: '',
                summary: ''
            },
            education: [],
            experience: [],
            skills: [],
            template: 'modern'
        };
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateProgressBar();
        this.showCurrentStep();
    }

    bindEvents() {
        // Navigation buttons
        document.getElementById('prevBtn').addEventListener('click', () => this.previousStep());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextStep());
        
        // Form inputs
        document.addEventListener('input', (e) => this.handleInput(e));
        document.addEventListener('change', (e) => this.handleInput(e));
        
        // Add/Remove buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-education')) {
                this.addEducation();
            } else if (e.target.classList.contains('remove-education')) {
                this.removeEducation(e.target.dataset.index);
            } else if (e.target.classList.contains('add-experience')) {
                this.addExperience();
            } else if (e.target.classList.contains('remove-experience')) {
                this.removeExperience(e.target.dataset.index);
            } else if (e.target.classList.contains('add-skill')) {
                this.addSkill();
            } else if (e.target.classList.contains('remove-skill')) {
                this.removeSkill(e.target.dataset.index);
            }
        });

        // Template selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-select')) {
                this.selectTemplate(e.target.dataset.template);
            }
        });

        // PDF Export
        document.getElementById('exportPDF').addEventListener('click', () => this.exportToPDF());
        
        // Save Resume
        document.getElementById('saveResume').addEventListener('click', () => this.saveResume());
        
        // Load saved resumes on page load
        this.loadSavedResumesList();
    }

    handleInput(e) {
        const { name, value, type, checked } = e.target;
        
        if (name.startsWith('personal_')) {
            const field = name.replace('personal_', '');
            this.resumeData.personalInfo[field] = value;
        } else if (name === 'title') {
            this.resumeData.title = value;
        } else if (name.startsWith('education_')) {
            const [, index, field] = name.split('_');
            if (this.resumeData.education[index]) {
                this.resumeData.education[index][field] = value;
            }
        } else if (name.startsWith('experience_')) {
            const [, index, field] = name.split('_');
            if (this.resumeData.experience[index]) {
                if (field === 'current' && type === 'checkbox') {
                    this.resumeData.experience[index][field] = checked;
                    // Disable end date if current job
                    const endDateInput = document.querySelector(`input[name="experience_${index}_endDate"]`);
                    if (endDateInput) {
                        endDateInput.disabled = checked;
                        if (checked) endDateInput.value = '';
                    }
                } else {
                    this.resumeData.experience[index][field] = value;
                }
            }
        } else if (name.startsWith('skill_')) {
            const index = name.split('_')[1];
            if (this.resumeData.skills[index] !== undefined) {
                this.resumeData.skills[index] = value;
            }
        }
        
        this.updatePreview();
        this.updateCompletionMeter();
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            if (this.currentStep < this.totalSteps - 1) {
                this.currentStep++;
                this.showCurrentStep();
                this.updateProgressBar();
            }
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showCurrentStep();
            this.updateProgressBar();
        }
    }

    showCurrentStep() {
        // Hide all steps
        document.querySelectorAll('.step').forEach(step => {
            step.style.display = 'none';
        });
        
        // Show current step
        const currentStepElement = document.getElementById(`step-${this.currentStep}`);
        if (currentStepElement) {
            currentStepElement.style.display = 'block';
        }
        
        // Update navigation buttons
        document.getElementById('prevBtn').disabled = this.currentStep === 0;
        document.getElementById('nextBtn').textContent = this.currentStep === this.totalSteps - 1 ? 'Finish' : 'Next';
        
        // Update step title
        const stepTitles = ['Personal Information', 'Education', 'Work Experience', 'Skills', 'Template & Preview'];
        document.getElementById('stepTitle').textContent = stepTitles[this.currentStep];
    }

    updateProgressBar() {
        const progress = ((this.currentStep + 1) / this.totalSteps) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('stepInfo').textContent = `Step ${this.currentStep + 1} of ${this.totalSteps}`;
    }

    validateCurrentStep() {
        const errors = [];
        
        switch (this.currentStep) {
            case 0: // Personal Information
                if (!this.resumeData.title.trim()) errors.push('Resume title is required');
                if (!this.resumeData.personalInfo.fullName.trim()) errors.push('Full name is required');
                if (!this.resumeData.personalInfo.email.trim()) errors.push('Email is required');
                if (!this.resumeData.personalInfo.phone.trim()) errors.push('Phone is required');
                if (!this.resumeData.personalInfo.address.trim()) errors.push('Address is required');
                if (!this.resumeData.personalInfo.summary.trim()) errors.push('Professional summary is required');
                break;
            case 1: // Education
                // Education is optional, but if added, must be complete
                this.resumeData.education.forEach((edu, index) => {
                    if (!edu.institution.trim()) errors.push(`Education ${index + 1}: Institution is required`);
                    if (!edu.degree.trim()) errors.push(`Education ${index + 1}: Degree is required`);
                    if (!edu.field.trim()) errors.push(`Education ${index + 1}: Field is required`);
                });
                break;
            case 2: // Experience
                // Experience is optional, but if added, must be complete
                this.resumeData.experience.forEach((exp, index) => {
                    if (!exp.company.trim()) errors.push(`Experience ${index + 1}: Company is required`);
                    if (!exp.position.trim()) errors.push(`Experience ${index + 1}: Position is required`);
                    if (!exp.description.trim()) errors.push(`Experience ${index + 1}: Description is required`);
                });
                break;
            case 3: // Skills
                const validSkills = this.resumeData.skills.filter(skill => skill.trim());
                if (validSkills.length === 0) errors.push('At least one skill is required');
                break;
        }
        
        if (errors.length > 0) {
            this.showErrors(errors);
            return false;
        }
        
        this.clearErrors();
        return true;
    }

    showErrors(errors) {
        const errorContainer = document.getElementById('errorContainer');
        errorContainer.innerHTML = errors.map(error => `<div class="error">${error}</div>`).join('');
        errorContainer.style.display = 'block';
    }

    clearErrors() {
        document.getElementById('errorContainer').style.display = 'none';
    }

    // Education Management
    addEducation() {
        const education = {
            id: this.generateId(),
            institution: '',
            degree: '',
            field: '',
            startDate: '',
            endDate: '',
            gpa: '',
            description: ''
        };
        this.resumeData.education.push(education);
        this.renderEducationForm();
    }

    removeEducation(index) {
        this.resumeData.education.splice(index, 1);
        this.renderEducationForm();
        this.updatePreview();
    }

    renderEducationForm() {
        const container = document.getElementById('educationContainer');
        container.innerHTML = this.resumeData.education.map((edu, index) => `
            <div class="education-item">
                <div class="form-row">
                    <div class="form-group">
                        <label>Institution</label>
                        <input type="text" name="education_${index}_institution" value="${edu.institution}" placeholder="University Name">
                    </div>
                    <div class="form-group">
                        <label>Degree</label>
                        <input type="text" name="education_${index}_degree" value="${edu.degree}" placeholder="Bachelor of Science">
                    </div>
                </div>
                <div class="form-group">
                    <label>Field of Study</label>
                    <input type="text" name="education_${index}_field" value="${edu.field}" placeholder="Computer Science">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="month" name="education_${index}_startDate" value="${edu.startDate}">
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="month" name="education_${index}_endDate" value="${edu.endDate}">
                    </div>
                    <div class="form-group">
                        <label>GPA (Optional)</label>
                        <input type="text" name="education_${index}_gpa" value="${edu.gpa}" placeholder="3.8">
                    </div>
                </div>
                <div class="form-group">
                    <label>Description (Optional)</label>
                    <textarea name="education_${index}_description" placeholder="Relevant coursework, achievements, etc.">${edu.description}</textarea>
                </div>
                <button type="button" class="remove-education btn-secondary" data-index="${index}">Remove</button>
            </div>
        `).join('');
    }

    // Experience Management
    addExperience() {
        const experience = {
            id: this.generateId(),
            company: '',
            position: '',
            location: '',
            startDate: '',
            endDate: '',
            current: false,
            description: ''
        };
        this.resumeData.experience.push(experience);
        this.renderExperienceForm();
    }

    removeExperience(index) {
        this.resumeData.experience.splice(index, 1);
        this.renderExperienceForm();
        this.updatePreview();
    }

    renderExperienceForm() {
        const container = document.getElementById('experienceContainer');
        container.innerHTML = this.resumeData.experience.map((exp, index) => `
            <div class="experience-item">
                <div class="form-row">
                    <div class="form-group">
                        <label>Company</label>
                        <input type="text" name="experience_${index}_company" value="${exp.company}" placeholder="Company Name">
                    </div>
                    <div class="form-group">
                        <label>Position</label>
                        <input type="text" name="experience_${index}_position" value="${exp.position}" placeholder="Software Engineer">
                    </div>
                </div>
                <div class="form-group">
                    <label>Location (Optional)</label>
                    <input type="text" name="experience_${index}_location" value="${exp.location}" placeholder="San Francisco, CA">
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="month" name="experience_${index}_startDate" value="${exp.startDate}">
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="month" name="experience_${index}_endDate" value="${exp.endDate}" ${exp.current ? 'disabled' : ''}>
                    </div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="experience_${index}_current" ${exp.current ? 'checked' : ''}>
                        Currently working here
                    </label>
                </div>
                <div class="form-group">
                    <label>Job Description</label>
                    <textarea name="experience_${index}_description" placeholder="Describe your responsibilities and achievements...">${exp.description}</textarea>
                </div>
                <button type="button" class="remove-experience btn-secondary" data-index="${index}">Remove</button>
            </div>
        `).join('');
    }

    // Skills Management
    addSkill() {
        this.resumeData.skills.push('');
        this.renderSkillsForm();
    }

    removeSkill(index) {
        this.resumeData.skills.splice(index, 1);
        this.renderSkillsForm();
        this.updatePreview();
    }

    renderSkillsForm() {
        const container = document.getElementById('skillsContainer');
        container.innerHTML = this.resumeData.skills.map((skill, index) => `
            <div class="skill-item">
                <input type="text" name="skill_${index}" value="${skill}" placeholder="e.g., JavaScript, React, Node.js">
                <button type="button" class="remove-skill btn-secondary" data-index="${index}">Remove</button>
            </div>
        `).join('');
    }

    // Template Selection
    selectTemplate(template) {
        this.resumeData.template = template;
        document.querySelectorAll('.template-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelector(`[data-template="${template}"]`).classList.add('selected');
        this.updatePreview();
    }

    // Preview Update
    updatePreview() {
        const previewContainer = document.getElementById('resumePreview');
        if (!previewContainer) return;
        
        if (this.resumeData.template === 'modern') {
            previewContainer.innerHTML = this.generateModernTemplate();
        } else {
            previewContainer.innerHTML = this.generateClassicTemplate();
        }
    }

    generateModernTemplate() {
        const formatDate = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString + '-01');
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        };

        return `
            <div class="resume-modern">
                <div class="resume-header">
                    <h1>${this.resumeData.personalInfo.fullName || 'Your Name'}</h1>
                    <div class="contact-info">
                        <p>${this.resumeData.personalInfo.email}</p>
                        <p>${this.resumeData.personalInfo.phone}</p>
                        <p>${this.resumeData.personalInfo.address}</p>
                        ${this.resumeData.personalInfo.linkedIn ? `<p>${this.resumeData.personalInfo.linkedIn}</p>` : ''}
                        ${this.resumeData.personalInfo.website ? `<p>${this.resumeData.personalInfo.website}</p>` : ''}
                    </div>
                </div>

                ${this.resumeData.personalInfo.summary ? `
                    <div class="resume-section">
                        <h2>Professional Summary</h2>
                        <p>${this.resumeData.personalInfo.summary}</p>
                    </div>
                ` : ''}

                ${this.resumeData.experience.length > 0 ? `
                    <div class="resume-section">
                        <h2>Work Experience</h2>
                        ${this.resumeData.experience.map(exp => `
                            <div class="experience-entry">
                                <div class="entry-header">
                                    <h3>${exp.position || 'Position'}</h3>
                                    <span class="date">${formatDate(exp.startDate)} - ${exp.current ? 'Present' : formatDate(exp.endDate)}</span>
                                </div>
                                <p class="company">${exp.company}${exp.location ? ` • ${exp.location}` : ''}</p>
                                <p class="description">${exp.description}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${this.resumeData.education.length > 0 ? `
                    <div class="resume-section">
                        <h2>Education</h2>
                        ${this.resumeData.education.map(edu => `
                            <div class="education-entry">
                                <div class="entry-header">
                                    <h3>${edu.degree || 'Degree'} in ${edu.field || 'Field'}</h3>
                                    <span class="date">${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}</span>
                                </div>
                                <p class="institution">${edu.institution}${edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</p>
                                ${edu.description ? `<p class="description">${edu.description}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${this.resumeData.skills.filter(skill => skill.trim()).length > 0 ? `
                    <div class="resume-section">
                        <h2>Skills</h2>
                        <div class="skills-container">
                            ${this.resumeData.skills.filter(skill => skill.trim()).map(skill => `
                                <span class="skill-tag">${skill}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    generateClassicTemplate() {
        const formatDate = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString + '-01');
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        };

        return `
            <div class="resume-classic">
                <div class="resume-header">
                    <h1>${this.resumeData.personalInfo.fullName || 'Your Name'}</h1>
                    <div class="contact-info">
                        ${this.resumeData.personalInfo.email} • ${this.resumeData.personalInfo.phone} • ${this.resumeData.personalInfo.address}
                        ${(this.resumeData.personalInfo.linkedIn || this.resumeData.personalInfo.website) ? '<br>' : ''}
                        ${this.resumeData.personalInfo.linkedIn || ''} ${this.resumeData.personalInfo.website ? `• ${this.resumeData.personalInfo.website}` : ''}
                    </div>
                </div>

                ${this.resumeData.personalInfo.summary ? `
                    <div class="resume-section">
                        <h2>OBJECTIVE</h2>
                        <p>${this.resumeData.personalInfo.summary}</p>
                    </div>
                ` : ''}

                ${this.resumeData.experience.length > 0 ? `
                    <div class="resume-section">
                        <h2>EXPERIENCE</h2>
                        ${this.resumeData.experience.map(exp => `
                            <div class="experience-entry">
                                <div class="entry-header">
                                    <h3>${exp.position || 'Position'}, ${exp.company}</h3>
                                    <span class="date">${formatDate(exp.startDate)} - ${exp.current ? 'Present' : formatDate(exp.endDate)}</span>
                                </div>
                                ${exp.location ? `<p class="location">${exp.location}</p>` : ''}
                                <p class="description">${exp.description}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${this.resumeData.education.length > 0 ? `
                    <div class="resume-section">
                        <h2>EDUCATION</h2>
                        ${this.resumeData.education.map(edu => `
                            <div class="education-entry">
                                <div class="entry-header">
                                    <h3>${edu.degree || 'Degree'} in ${edu.field || 'Field'}</h3>
                                    <span class="date">${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}</span>
                                </div>
                                <p class="institution">${edu.institution}${edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</p>
                                ${edu.description ? `<p class="description">${edu.description}</p>` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${this.resumeData.skills.filter(skill => skill.trim()).length > 0 ? `
                    <div class="resume-section">
                        <h2>SKILLS</h2>
                        <p>${this.resumeData.skills.filter(skill => skill.trim()).join(' • ')}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // PDF Export
    exportToPDF() {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow pop-ups to download your resume as PDF');
            return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${this.resumeData.personalInfo.fullName || 'Resume'} - Resume</title>
                <style>
                    @media print {
                        body { margin: 0; }
                        @page { margin: 0.5in; }
                    }
                    body {
                        margin: 0;
                        padding: 20px;
                        background: white;
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                    }
                    .resume-modern {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .resume-classic {
                        max-width: 800px;
                        margin: 0 auto;
                        font-family: 'Times New Roman', serif;
                    }
                    .resume-header {
                        border-bottom: ${this.resumeData.template === 'modern' ? '4px solid #2563eb' : '2px solid #1f2937'};
                        padding-bottom: 16px;
                        margin-bottom: 24px;
                        ${this.resumeData.template === 'classic' ? 'text-align: center;' : ''}
                    }
                    .resume-header h1 {
                        font-size: ${this.resumeData.template === 'modern' ? '36px' : '28px'};
                        font-weight: bold;
                        color: #1f2937;
                        margin-bottom: 8px;
                    }
                    .contact-info {
                        color: #6b7280;
                        font-size: ${this.resumeData.template === 'classic' ? '14px' : '16px'};
                    }
                    .resume-section {
                        margin-bottom: 24px;
                    }
                    .resume-section h2 {
                        font-size: ${this.resumeData.template === 'modern' ? '20px' : '16px'};
                        font-weight: bold;
                        color: #1f2937;
                        margin-bottom: 12px;
                        ${this.resumeData.template === 'modern' ? 'border-bottom: 1px solid #d1d5db;' : 'text-transform: uppercase; letter-spacing: 1px;'}
                        padding-bottom: 4px;
                    }
                    .entry-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 4px;
                    }
                    .entry-header h3 {
                        font-size: 18px;
                        font-weight: 600;
                        color: #1f2937;
                        margin: 0;
                    }
                    .date {
                        color: #6b7280;
                        font-size: 14px;
                    }
                    .company {
                        color: ${this.resumeData.template === 'modern' ? '#2563eb' : '#6b7280'};
                        font-weight: 500;
                        margin: 0 0 8px 0;
                    }
                    .institution {
                        color: ${this.resumeData.template === 'modern' ? '#2563eb' : '#6b7280'};
                        font-weight: 500;
                        margin: 0 0 8px 0;
                    }
                    .description {
                        color: #374151;
                        line-height: 1.7;
                        white-space: pre-line;
                        margin: 0;
                    }
                    .location {
                        color: #6b7280;
                        font-size: 14px;
                        font-style: italic;
                        margin: 4px 0;
                    }
                    .skills-container {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    .skill-tag {
                        background-color: #dbeafe;
                        color: #1e40af;
                        padding: 4px 12px;
                        border-radius: 9999px;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    .experience-entry, .education-entry {
                        margin-bottom: 16px;
                    }
                </style>
            </head>
            <body>
                ${this.resumeData.template === 'modern' ? this.generateModernTemplate() : this.generateClassicTemplate()}
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 250);
    }

    // Save Resume (to PHP backend)
    async saveResume() {
        try {
            const user = JSON.parse(localStorage.getItem('user'));
            const token = sessionStorage.getItem('authToken');
            
            if (!user || !token) {
                alert('Please login to save your resume.');
                window.location.href = 'home.html';
                return;
            }
            
            // Add user ID to resume data
            const resumeToSave = {
                ...this.resumeData,
                userId: user.id
            };
            
            const response = await fetch('api.php/resumes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(resumeToSave)
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('Resume saved successfully!');
                this.resumeData.id = result.data.id;
            } else {
                alert('Error saving resume: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error saving resume. Please try again.');
        }
    }

    // Load Resume
    async loadResume(resumeId) {
        try {
            const response = await fetch(`api.php/resumes?id=${resumeId}`);
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
                this.resumeData = {
                    id: result.data[0].id,
                    title: result.data[0].title,
                    personalInfo: result.data[0].personal_info,
                    education: result.data[0].education || [],
                    experience: result.data[0].experience || [],
                    skills: result.data[0].skills || [],
                    template: result.data[0].template || 'modern'
                };
                this.populateForm();
                this.updatePreview();
            }
        } catch (error) {
            console.error('Error loading resume:', error);
            alert('Error loading resume. Please try again.');
        }
    }

    // Populate form with loaded data
    populateForm() {
        // Personal info
        Object.keys(this.resumeData.personalInfo).forEach(key => {
            const input = document.querySelector(`[name="personal_${key}"]`);
            if (input) input.value = this.resumeData.personalInfo[key];
        });
        
        // Title
        const titleInput = document.querySelector('[name="title"]');
        if (titleInput) titleInput.value = this.resumeData.title;
        
        // Render dynamic sections
        this.renderEducationForm();
        this.renderExperienceForm();
        this.renderSkillsForm();
        
        // Template selection
        if (this.resumeData.template) {
            this.selectTemplate(this.resumeData.template);
        }
    }

    // Utility function to generate unique IDs
    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Get completion percentage
    getCompletionPercentage() {
        let score = 0;
        let maxScore = 100;

        // Personal Info (40%)
        if (this.resumeData.personalInfo.fullName.trim()) score += 8;
        if (this.resumeData.personalInfo.email.trim()) score += 8;
        if (this.resumeData.personalInfo.phone.trim()) score += 8;
        if (this.resumeData.personalInfo.address.trim()) score += 8;
        if (this.resumeData.personalInfo.summary.trim()) score += 8;

        // Experience (30%)
        if (this.resumeData.experience.length > 0) score += 30;

        // Education (20%)
        if (this.resumeData.education.length > 0) score += 20;

        // Skills (10%)
        if (this.resumeData.skills.filter(skill => skill.trim()).length > 0) score += 10;

        return Math.round(score);
    }

    // Update completion meter
    updateCompletionMeter() {
        const percentage = this.getCompletionPercentage();
        const completionFill = document.getElementById('completionFill');
        const completionText = document.getElementById('completionText');
        
        if (completionFill) {
            completionFill.style.width = `${percentage}%`;
        }
        if (completionText) {
            completionText.textContent = `${percentage}% Complete`;
        }
    }

    // Load saved resumes list
    async loadSavedResumesList() {
        try {
            const response = await fetch('api.php/resumes');
            const result = await response.json();
            
            if (result.success) {
                this.displaySavedResumesList(result.data);
            }
        } catch (error) {
            console.error('Error loading saved resumes:', error);
        }
    }

    // Display saved resumes (you can add a UI element for this)
    displaySavedResumesList(resumes) {
        // This function can be used to show a list of saved resumes
        // You can add HTML elements to display this list
        console.log('Saved resumes:', resumes);
    }

    // Update resume (for existing resumes)
    async updateResume() {
        if (!this.resumeData.id) {
            // If no ID, create new resume
            return this.saveResume();
        }
        
        try {
            const response = await fetch('api.php/resumes', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.resumeData)
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('Resume updated successfully!');
            } else {
                alert('Error updating resume: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error updating resume. Please try again.');
        }
    }

    // Delete resume
    async deleteResume(resumeId) {
        if (!confirm('Are you sure you want to delete this resume?')) {
            return;
        }
        
        try {
            const response = await fetch('api.php/resumes', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: resumeId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('Resume deleted successfully!');
                this.loadSavedResumesList();
            } else {
                alert('Error deleting resume: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error deleting resume. Please try again.');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.resumeBuilder = new ResumeBuilder();
    
    // Add initial empty items if needed
    if (window.resumeBuilder.resumeData.education.length === 0) {
        window.resumeBuilder.addEducation();
    }
    if (window.resumeBuilder.resumeData.experience.length === 0) {
        window.resumeBuilder.addExperience();
    }
    if (window.resumeBuilder.resumeData.skills.length === 0) {
        window.resumeBuilder.addSkill();
    }
    
    // Check login status and update UI
    checkLoginStatus();
});

// Function to go back to home page
function goToHome() {
    window.location.href = 'home.html';
}

// Function to logout
function logout() {
    localStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    window.location.href = 'home.html';
}

// Function to check login status and update UI
function checkLoginStatus() {
    const user = localStorage.getItem('user');
    const token = sessionStorage.getItem('authToken');
    
    if (user && token) {
        try {
            const userData = JSON.parse(user);
            const userInfo = document.getElementById('userInfo');
            const userGreeting = document.getElementById('userGreeting');
            
            if (userInfo && userGreeting) {
                userGreeting.textContent = `Hi, ${userData.name}!`;
                userInfo.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error parsing user data:', error);
        }
    }
}