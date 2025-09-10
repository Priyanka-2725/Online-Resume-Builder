// Resume Builder JavaScript
class ResumeBuilder {
    constructor() {
        this.currentStep = 0;
        this.totalSteps = 7;
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
            projects: [],
            achievements: [],
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
            } else if (e.target.classList.contains('add-project')) {
                this.addProject();
            } else if (e.target.classList.contains('remove-project')) {
                this.removeProject(e.target.dataset.index);
            } else if (e.target.classList.contains('add-achievement')) {
                this.addAchievement();
            } else if (e.target.classList.contains('remove-achievement')) {
                this.removeAchievement(e.target.dataset.index);
            }
        });

        // Template selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('template-select')) {
                this.selectTemplate(e.target.dataset.template);
            }
        });

        // PDF Download via server (dompdf)
        const downloadBtn = document.getElementById('downloadPDF');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadPDF());
        }
        
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
        } else if (name.startsWith('project_')) {
            const [, index, field] = name.split('_');
            if (this.resumeData.projects[index]) {
                if (field === 'current' && type === 'checkbox') {
                    this.resumeData.projects[index][field] = checked;
                    // Disable end date if current project
                    const endDateInput = document.querySelector(`input[name="project_${index}_endDate"]`);
                    if (endDateInput) {
                        endDateInput.disabled = checked;
                        if (checked) endDateInput.value = '';
                    }
                } else {
                    this.resumeData.projects[index][field] = value;
                }
            }
        } else if (name.startsWith('achievement_')) {
            const [, index, field] = name.split('_');
            if (this.resumeData.achievements[index]) {
                this.resumeData.achievements[index][field] = value;
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
            } else {
                // This is the final step - handle completion
                this.handleResumeCompletion();
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

    handleResumeCompletion() {
        // Show completion message
        const completionMessage = document.createElement('div');
        completionMessage.className = 'completion-message';
        completionMessage.innerHTML = `
            <div class="completion-content">
                <h2>🎉 Resume Completed!</h2>
                <p>Your resume has been successfully created. You can now:</p>
                <div class="completion-actions">
                    <button class="btn-primary" onclick="resumeBuilder.saveResume()">
                        💾 Save My Resume
                    </button>
                    <button class="btn-secondary" onclick="resumeBuilder.exportToPDF()">
                        🖨️ Print Resume
                    </button>
                    <button class="btn-secondary" onclick="resumeBuilder.showMyResumesFromCompletion()">
                        📋 View My Resumes
                    </button>
                    <button class="btn-secondary" onclick="resumeBuilder.resetForm()">
                        ➕ Create New Resume
                    </button>
                </div>
            </div>
        `;
        
        // Hide the form and show completion message
        document.getElementById('resumeBuilderContent').style.display = 'none';
        document.getElementById('myResumesSection').style.display = 'none';
        
        // Add completion message to the page
        const container = document.querySelector('.container');
        container.appendChild(completionMessage);
    }

    showMyResumesFromCompletion() {
        // Remove completion message
        const completionMessage = document.querySelector('.completion-message');
        if (completionMessage) {
            completionMessage.remove();
        }
        
        // Show My Resumes section
        showMyResumes();
    }

    resetForm() {
        // Reset form data
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
            projects: [],
            achievements: [],
            template: 'modern'
        };
        
        // Reset to first step
        this.currentStep = 0;
        this.showCurrentStep();
        this.updateProgressBar();
        
        // Clear form inputs
        document.querySelectorAll('input, textarea').forEach(input => {
            input.value = '';
        });
        
        // Remove completion message and show form
        const completionMessage = document.querySelector('.completion-message');
        if (completionMessage) {
            completionMessage.remove();
        }
        
        // Show resume builder content and hide My Resumes section
        document.getElementById('resumeBuilderContent').style.display = 'grid';
        document.getElementById('myResumesSection').style.display = 'none';
        
        // Re-add initial empty items
        this.addEducation();
        this.addExperience();
        this.addSkill();
        this.addProject();
        this.addAchievement();
        
        this.updatePreview();
        this.updateCompletionMeter();
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
        const stepTitles = ['Personal Information', 'Education', 'Work Experience', 'Projects', 'Achievements', 'Skills', 'Template & Preview'];
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
            case 3: // Projects (moved earlier)
                // Projects are optional, but if added, must be complete
                this.resumeData.projects.forEach((project, index) => {
                    if (!project.name.trim()) errors.push(`Project ${index + 1}: Project name is required`);
                    if (!project.description.trim()) errors.push(`Project ${index + 1}: Description is required`);
                });
                break;
            case 4: // Achievements
                // Achievements are optional, but if added, must be complete
                this.resumeData.achievements.forEach((ach, index) => {
                    if (!ach.title.trim()) errors.push(`Achievement ${index + 1}: Title is required`);
                });
                break;
            case 5: // Skills (moved later)
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

    // Projects Management
    addProject() {
        const project = {
            id: this.generateId(),
            name: '',
            description: '',
            technologies: '',
            url: '',
            startDate: '',
            endDate: '',
            current: false
        };
        this.resumeData.projects.push(project);
        this.renderProjectsForm();
    }

    removeProject(index) {
        this.resumeData.projects.splice(index, 1);
        this.renderProjectsForm();
        this.updatePreview();
    }

    renderProjectsForm() {
        const container = document.getElementById('projectsContainer');
        container.innerHTML = this.resumeData.projects.map((project, index) => `
            <div class="project-item">
                <div class="form-group">
                    <label>Project Name *</label>
                    <input type="text" name="project_${index}_name" value="${project.name}" placeholder="e.g., E-commerce Website">
                </div>
                <div class="form-group">
                    <label>Description *</label>
                    <textarea name="project_${index}_description" placeholder="Describe what the project does and your role...">${project.description}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Technologies Used</label>
                        <input type="text" name="project_${index}_technologies" value="${project.technologies}" placeholder="e.g., React, Node.js, MongoDB">
                    </div>
                    <div class="form-group">
                        <label>Project URL (Optional)</label>
                        <input type="url" name="project_${index}_url" value="${project.url}" placeholder="https://github.com/username/project">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="month" name="project_${index}_startDate" value="${project.startDate}">
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="month" name="project_${index}_endDate" value="${project.endDate}" ${project.current ? 'disabled' : ''}>
                    </div>
                </div>
                <div class="form-group">
                    <label>
                        <input type="checkbox" name="project_${index}_current" ${project.current ? 'checked' : ''}>
                        Currently working on this project
                    </label>
                </div>
                <button type="button" class="remove-project btn-secondary" data-index="${index}">Remove</button>
            </div>
        `).join('');
    }

    // Achievements Management
    addAchievement() {
        const achievement = {
            id: this.generateId(),
            title: '',
            issuer: '',
            date: '',
            description: ''
        };
        this.resumeData.achievements.push(achievement);
        this.renderAchievementsForm();
    }

    removeAchievement(index) {
        this.resumeData.achievements.splice(index, 1);
        this.renderAchievementsForm();
        this.updatePreview();
    }

    renderAchievementsForm() {
        const container = document.getElementById('achievementsContainer');
        if (!container) return;
        container.innerHTML = this.resumeData.achievements.map((ach, index) => `
            <div class="achievement-item">
                <div class="form-row">
                    <div class="form-group">
                        <label>Title *</label>
                        <input type="text" name="achievement_${index}_title" value="${ach.title}" placeholder="e.g., Winner - Hackathon 2024">
                    </div>
                    <div class="form-group">
                        <label>Issuer (Optional)</label>
                        <input type="text" name="achievement_${index}_issuer" value="${ach.issuer}" placeholder="e.g., Google, University Name">
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Date</label>
                        <input type="month" name="achievement_${index}_date" value="${ach.date}">
                    </div>
                </div>
                <div class="form-group">
                    <label>Description (Optional)</label>
                    <textarea name="achievement_${index}_description" placeholder="Brief details or impact...">${ach.description}</textarea>
                </div>
                <button type="button" class="remove-achievement btn-secondary" data-index="${index}">Remove</button>
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

                ${this.resumeData.projects.length > 0 ? `
                    <div class="resume-section">
                        <h2>Projects</h2>
                        ${this.resumeData.projects.map(project => `
                            <div class="project-entry">
                                <div class="entry-header">
                                    <h3>${project.name || 'Project Name'}</h3>
                                    <span class="date">${formatDate(project.startDate)} - ${project.current ? 'Present' : formatDate(project.endDate)}</span>
                                </div>
                                ${project.technologies ? `<p class="technologies">Technologies: ${project.technologies}</p>` : ''}
                                ${project.url ? `<p class="project-url"><a href="${project.url}" target="_blank">View Project</a></p>` : ''}
                                <p class="description">${project.description}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${this.resumeData.achievements.length > 0 ? `
                    <div class="resume-section">
                        <h2>Achievements</h2>
                        ${this.resumeData.achievements.map(ach => `
                            <div class="achievement-entry">
                                <div class="entry-header">
                                    <h3>${ach.title || 'Achievement'}</h3>
                                    <span class="date">${formatDate(ach.date)}</span>
                                </div>
                                ${ach.issuer ? `<p class="company">${ach.issuer}</p>` : ''}
                                ${ach.description ? `<p class="description">${ach.description}</p>` : ''}
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

                ${this.resumeData.projects.length > 0 ? `
                    <div class="resume-section">
                        <h2>PROJECTS</h2>
                        ${this.resumeData.projects.map(project => `
                            <div class="project-entry">
                                <div class="entry-header">
                                    <h3>${project.name || 'Project Name'}</h3>
                                    <span class="date">${formatDate(project.startDate)} - ${project.current ? 'Present' : formatDate(project.endDate)}</span>
                                </div>
                                ${project.technologies ? `<p class="technologies">Technologies: ${project.technologies}</p>` : ''}
                                ${project.url ? `<p class="project-url"><a href="${project.url}" target="_blank">View Project</a></p>` : ''}
                                <p class="description">${project.description}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}

                ${this.resumeData.achievements.length > 0 ? `
                    <div class="resume-section">
                        <h2>ACHIEVEMENTS</h2>
                        ${this.resumeData.achievements.map(ach => `
                            <div class="achievement-entry">
                                <div class="entry-header">
                                    <h3>${ach.title || 'Achievement'}${ach.issuer ? `, ${ach.issuer}` : ''}</h3>
                                    <span class="date">${formatDate(ach.date)}</span>
                                </div>
                                ${ach.description ? `<p class="description">${ach.description}</p>` : ''}
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

    // Server-side PDF download (dompdf)
    async downloadPDF() {
        try {
            const token = sessionStorage.getItem('authToken');
            const response = await fetch('api.php?endpoint=download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    resume: this.resumeData
                })
            });
            
            if (!response.ok) {
                const contentType = response.headers.get('Content-Type') || '';
                let message = 'Failed to generate PDF';
                if (contentType.includes('application/json')) {
                    try {
                        const j = await response.json();
                        message = j.error || j.message || message;
                    } catch {}
                } else {
                    try { message = await response.text(); } catch {}
                }
                throw new Error(message);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const fileName = `${this.resumeData.personalInfo.fullName || 'Resume'}_${new Date().toISOString().split('T')[0]}.pdf`;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            // Graceful fallback to client-side printable HTML if server PDF fails
            try {
        const printWindow = window.open('', '_blank');
        const printContent = this.generatePDFHTML();
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.onload = function() {
            printWindow.focus();
            printWindow.print();
        };
                alert('Server PDF generation failed. Opening print dialog as fallback. You can save as PDF from there.');
            } catch (e) {
                alert('PDF generation failed: ' + (error.message || 'Unknown error') + '. Please try again or contact support.');
            }
        }
    }

    createPDF() {
        try {
            // Debug: Log what's available
            console.log('Checking jsPDF availability...');
            console.log('window.jsPDF:', window.jsPDF);
            console.log('typeof window.jsPDF:', typeof window.jsPDF);
            
            // Try multiple ways to get jsPDF
            let jsPDF;
            
            if (window.jsPDF && window.jsPDF.jsPDF) {
                jsPDF = window.jsPDF.jsPDF;
                console.log('Found jsPDF via window.jsPDF.jsPDF');
            } else if (window.jsPDF && typeof window.jsPDF === 'function') {
                jsPDF = window.jsPDF;
                console.log('Found jsPDF as function');
            } else if (window.jsPDF && window.jsPDF.default) {
                jsPDF = window.jsPDF.default;
                console.log('Found jsPDF via default');
            } else if (typeof window.jsPDF !== 'undefined') {
                jsPDF = window.jsPDF;
                console.log('Found jsPDF directly');
            } else {
                // Try to load it dynamically
                console.log('jsPDF not found, trying to load dynamically...');
                this.loadJsPDFDynamically();
                return;
            }

            // Create new PDF document
            const doc = new jsPDF();
            
            // Set initial position and margins
            let y = 20;
            const margin = 20;
            const pageWidth = doc.internal.pageSize.width;
            const contentWidth = pageWidth - (2 * margin);
            
            // Header - Name
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            const name = this.resumeData.personalInfo.fullName || 'Your Name';
            doc.text(name, margin, y);
            y += 15;
            
            // Contact Information
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const contactInfo = [
                this.resumeData.personalInfo.email,
                this.resumeData.personalInfo.phone,
                this.resumeData.personalInfo.address
            ].filter(info => info && info.trim());
            
            contactInfo.forEach(info => {
                doc.text(info, margin, y);
                y += 5;
            });
            
            y += 10;
            
            // Professional Summary
            if (this.resumeData.personalInfo.summary) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Professional Summary', margin, y);
                y += 8;
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                const summaryLines = doc.splitTextToSize(this.resumeData.personalInfo.summary, contentWidth);
                doc.text(summaryLines, margin, y);
                y += (summaryLines.length * 5) + 10;
            }
            
            // Work Experience
            if (this.resumeData.experience.length > 0) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Work Experience', margin, y);
                y += 8;
                
                this.resumeData.experience.forEach(exp => {
                    // Check if we need a new page
                    if (y > 250) {
                        doc.addPage();
                        y = 20;
                    }
                    
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text(exp.position || 'Position', margin, y);
                    y += 6;
                    
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    const companyText = `${exp.company}${exp.location ? ` • ${exp.location}` : ''}`;
                    doc.text(companyText, margin, y);
                    y += 5;
                    
                    const dateText = `${this.formatDate(exp.startDate)} - ${exp.current ? 'Present' : this.formatDate(exp.endDate)}`;
                    doc.text(dateText, margin, y);
                    y += 8;
                    
                    if (exp.description) {
                        const descLines = doc.splitTextToSize(exp.description, contentWidth);
                        doc.text(descLines, margin, y);
                        y += (descLines.length * 5) + 5;
                    }
                });
            }
            
            // Education
            if (this.resumeData.education.length > 0) {
                // Check if we need a new page
                if (y > 200) {
                    doc.addPage();
                    y = 20;
                }
                
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Education', margin, y);
                y += 8;
                
                this.resumeData.education.forEach(edu => {
                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    const degreeText = `${edu.degree || 'Degree'} in ${edu.field || 'Field'}`;
                    doc.text(degreeText, margin, y);
                    y += 6;
                    
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'normal');
                    const institutionText = `${edu.institution}${edu.gpa ? ` • GPA: ${edu.gpa}` : ''}`;
                    doc.text(institutionText, margin, y);
                    y += 5;
                    
                    const dateText = `${this.formatDate(edu.startDate)} - ${this.formatDate(edu.endDate)}`;
                    doc.text(dateText, margin, y);
                    y += 8;
                    
                    if (edu.description) {
                        const descLines = doc.splitTextToSize(edu.description, contentWidth);
                        doc.text(descLines, margin, y);
                        y += (descLines.length * 5) + 5;
                    }
                });
            }
            
            // Skills
            const validSkills = this.resumeData.skills.filter(skill => skill.trim());
            if (validSkills.length > 0) {
                // Check if we need a new page
                if (y > 200) {
                    doc.addPage();
                    y = 20;
                }
                
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text('Skills', margin, y);
                y += 8;
                
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(validSkills.join(' • '), margin, y);
            }
            
            // Save the PDF - THIS IS THE KEY PART
            const fileName = `${this.resumeData.personalInfo.fullName || 'Resume'}_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);
            
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('PDF generation failed: ' + error.message);
        }
    }

    loadJsPDFDynamically() {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => {
            console.log('jsPDF loaded dynamically');
            setTimeout(() => {
                this.createPDF();
            }, 500);
        };
        script.onerror = () => {
            alert('Failed to load PDF library. Please check your internet connection.');
        };
        document.head.appendChild(script);
    }

    generatePDFHTML() {
        const formatDate = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString + '-01');
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        };

        return `
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
                        color: #333;
                    }
                    .resume-container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .header {
                        border-bottom: 3px solid #2563eb;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .name {
                        font-size: 32px;
                        font-weight: bold;
                        color: #1f2937;
                        margin-bottom: 10px;
                    }
                    .contact-info {
                        color: #6b7280;
                        font-size: 14px;
                        line-height: 1.4;
                    }
                    .section {
                        margin-bottom: 25px;
                    }
                    .section-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #1f2937;
                        margin-bottom: 15px;
                        border-bottom: 1px solid #d1d5db;
                        padding-bottom: 5px;
                    }
                    .entry {
                        margin-bottom: 15px;
                    }
                    .entry-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 5px;
                    }
                    .entry-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: #1f2937;
                        margin: 0;
                    }
                    .entry-date {
                        color: #6b7280;
                        font-size: 12px;
                        white-space: nowrap;
                    }
                    .entry-subtitle {
                        color: #2563eb;
                        font-weight: 500;
                        margin: 0 0 8px 0;
                        font-size: 14px;
                    }
                    .entry-description {
                        color: #374151;
                        line-height: 1.6;
                        white-space: pre-line;
                        margin: 0;
                        font-size: 14px;
                    }
                    .skills-list {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    }
                    .skill-tag {
                        background-color: #dbeafe;
                        color: #1e40af;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    @media print {
                        .resume-container {
                            max-width: none;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="resume-container">
                    <div class="header">
                        <div class="name">${this.resumeData.personalInfo.fullName || 'Your Name'}</div>
                        <div class="contact-info">
                            ${this.resumeData.personalInfo.email ? `<div>${this.resumeData.personalInfo.email}</div>` : ''}
                            ${this.resumeData.personalInfo.phone ? `<div>${this.resumeData.personalInfo.phone}</div>` : ''}
                            ${this.resumeData.personalInfo.address ? `<div>${this.resumeData.personalInfo.address}</div>` : ''}
                            ${this.resumeData.personalInfo.linkedIn ? `<div>${this.resumeData.personalInfo.linkedIn}</div>` : ''}
                            ${this.resumeData.personalInfo.website ? `<div>${this.resumeData.personalInfo.website}</div>` : ''}
                        </div>
                    </div>

                    ${this.resumeData.personalInfo.summary ? `
                        <div class="section">
                            <div class="section-title">Professional Summary</div>
                            <div class="entry-description">${this.resumeData.personalInfo.summary}</div>
                        </div>
                    ` : ''}

                    ${this.resumeData.experience.length > 0 ? `
                        <div class="section">
                            <div class="section-title">Work Experience</div>
                            ${this.resumeData.experience.map(exp => `
                                <div class="entry">
                                    <div class="entry-header">
                                        <div class="entry-title">${exp.position || 'Position'}</div>
                                        <div class="entry-date">${formatDate(exp.startDate)} - ${exp.current ? 'Present' : formatDate(exp.endDate)}</div>
                                    </div>
                                    <div class="entry-subtitle">${exp.company}${exp.location ? ` • ${exp.location}` : ''}</div>
                                    <div class="entry-description">${exp.description || ''}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${this.resumeData.education.length > 0 ? `
                        <div class="section">
                            <div class="section-title">Education</div>
                            ${this.resumeData.education.map(edu => `
                                <div class="entry">
                                    <div class="entry-header">
                                        <div class="entry-title">${edu.degree || 'Degree'} in ${edu.field || 'Field'}</div>
                                        <div class="entry-date">${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}</div>
                                    </div>
                                    <div class="entry-subtitle">${edu.institution}${edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</div>
                                    ${edu.description ? `<div class="entry-description">${edu.description}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${this.resumeData.projects.length > 0 ? `
                        <div class="section">
                            <div class="section-title">Projects</div>
                            ${this.resumeData.projects.map(project => `
                                <div class="entry">
                                    <div class="entry-header">
                                        <div class="entry-title">${project.name || 'Project Name'}</div>
                                        <div class="entry-date">${formatDate(project.startDate)} - ${project.current ? 'Present' : formatDate(project.endDate)}</div>
                                    </div>
                                    ${project.technologies ? `<div class="entry-subtitle">Technologies: ${project.technologies}</div>` : ''}
                                    ${project.url ? `<div class="entry-subtitle"><a href="${project.url}" target="_blank">View Project</a></div>` : ''}
                                    <div class="entry-description">${project.description || ''}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${this.resumeData.achievements.length > 0 ? `
                        <div class="section">
                            <div class="section-title">Achievements</div>
                            ${this.resumeData.achievements.map(ach => `
                                <div class="entry">
                                    <div class="entry-header">
                                        <div class="entry-title">${ach.title || 'Achievement'}</div>
                                        <div class="entry-date">${formatDate(ach.date)}</div>
                                    </div>
                                    ${ach.issuer ? `<div class="entry-subtitle">${ach.issuer}</div>` : ''}
                                    ${ach.description ? `<div class="entry-description">${ach.description}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}

                    ${this.resumeData.skills.filter(skill => skill.trim()).length > 0 ? `
                        <div class="section">
                            <div class="section-title">Skills</div>
                            <div class="skills-list">
                                ${this.resumeData.skills.filter(skill => skill.trim()).map(skill => `
                                    <span class="skill-tag">${skill}</span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </body>
            </html>
        `;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString + '-01');
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
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
            
            const response = await fetch('api.php?endpoint=resumes', {
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
                
                // Update the completion message to show success
                const saveButton = document.querySelector('.completion-actions .btn-primary');
                if (saveButton) {
                    saveButton.textContent = '✅ Resume Saved!';
                    saveButton.disabled = true;
                    saveButton.style.background = '#10b981';
                }
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
            const response = await fetch(`api.php?endpoint=resumes&id=${resumeId}`);
            const result = await response.json();
            
            if (result.success && result.data.length > 0) {
                this.resumeData = {
                    id: result.data[0].id,
                    title: result.data[0].title,
                    personalInfo: result.data[0].personal_info,
                    education: result.data[0].education || [],
                    experience: result.data[0].experience || [],
                    skills: result.data[0].skills || [],
                    projects: result.data[0].projects || [],
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
        this.renderProjectsForm();
        this.renderAchievementsForm();
        
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

        // Experience (25%)
        if (this.resumeData.experience.length > 0) score += 25;

        // Education (20%)
        if (this.resumeData.education.length > 0) score += 20;

        // Projects (12%)
        if (this.resumeData.projects.length > 0) score += 12;

        // Skills (8%)
        if (this.resumeData.skills.filter(skill => skill.trim()).length > 0) score += 8;

        // Achievements (15%)
        if (this.resumeData.achievements.length > 0) score += 15;

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
            const response = await fetch('api.php?endpoint=resumes');
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
            const token = sessionStorage.getItem('authToken');
            const response = await fetch('api.php?endpoint=resumes', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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
            const response = await fetch('api.php?endpoint=resumes', {
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
    // Theme initialization
    try {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        setTheme(theme);
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
            toggleBtn.addEventListener('click', () => {
                const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                const next = current === 'dark' ? 'light' : 'dark';
                setTheme(next);
                localStorage.setItem('theme', next);
                toggleBtn.textContent = next === 'dark' ? '☀️' : '🌙';
            });
        }
    } catch (e) { console.warn('Theme init failed', e); }
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
    if (window.resumeBuilder.resumeData.projects.length === 0) {
        window.resumeBuilder.addProject();
    }
    
    // Check login status and update UI
    checkLoginStatus();

    // If URL asks for My Resumes view, show it
    try {
        const params = new URLSearchParams(window.location.search);
        const view = params.get('view');
        if (view === 'my-resumes') {
            showMyResumes();
        }
    } catch (e) {
        console.error('Error parsing URL params', e);
    }
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

function setTheme(mode) {
    if (mode === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

// Function to show My Resumes section
function showMyResumes() {
    const myResumesSection = document.getElementById('myResumesSection');
    const resumeBuilderContent = document.getElementById('resumeBuilderContent');
    
    if (myResumesSection && resumeBuilderContent) {
        myResumesSection.style.display = 'block';
        resumeBuilderContent.style.display = 'none';
        
        // Remove any completion message that might be present
        const completionMessage = document.querySelector('.completion-message');
        if (completionMessage) {
            completionMessage.remove();
        }
        
        loadSavedResumes();
    }
}

// Function to show Resume Builder
function showResumeBuilder() {
    const myResumesSection = document.getElementById('myResumesSection');
    const resumeBuilderContent = document.getElementById('resumeBuilderContent');
    
    if (myResumesSection && resumeBuilderContent) {
        myResumesSection.style.display = 'none';
        resumeBuilderContent.style.display = 'grid';
    }
}

// Create a fresh resume and open the builder form
function createNewResume() {
    if (!window.resumeBuilder) return;
    window.resumeBuilder.resumeData = {
        id: null,
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
        projects: [],
        achievements: [],
        template: 'modern'
    };
    window.resumeBuilder.populateForm();
    window.resumeBuilder.updatePreview();
    showResumeBuilder();
    window.resumeBuilder.currentStep = 0;
    window.resumeBuilder.showCurrentStep();
    window.resumeBuilder.updateProgressBar();
}

// Function to load and display saved resumes
async function loadSavedResumes() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        const token = sessionStorage.getItem('authToken');
        
        if (!user || !token) {
            displayResumes([]);
            return;
        }
        
        const response = await fetch('api.php?endpoint=resumes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();
        
        if (result.success) {
            displayResumes(result.data);
        } else {
            displayResumes([]);
        }
    } catch (error) {
        console.error('Error loading resumes:', error);
        displayResumes([]);
    }
}

// Function to display resumes in the grid
function displayResumes(resumes) {
    const resumesGrid = document.getElementById('resumesGrid');
    const resumesCount = document.getElementById('resumesCount');
    
    if (!resumesGrid) return;
    
    if (resumes.length === 0) {
        resumesGrid.innerHTML = `
            <div class="empty-resumes">
                <h3>No saved resumes yet</h3>
                <p>Create your first resume to get started!</p>
                <button class="btn-primary" onclick="showResumeBuilder()">Create Resume</button>
            </div>
        `;
        if (resumesCount) resumesCount.textContent = '(0)';
        return;
    }
    
    if (resumesCount) resumesCount.textContent = `(${resumes.length})`;
    resumesGrid.innerHTML = resumes.map(resume => `
        <div class="resume-card" onclick="editResume('${resume.id}')">
            <h3>${resume.title || 'Untitled Resume'}</h3>
            <div class="resume-meta">
                <div>Created: ${new Date(resume.created_at).toLocaleDateString()}</div>
                <div>Template: ${resume.template || 'Modern'}</div>
                <div>Name: ${resume.personal_info?.fullName || 'Not specified'}</div>
            </div>
            <div class="resume-actions">
                <button class="btn-small btn-edit" onclick="event.stopPropagation(); editResume('${resume.id}')">
                    Edit
                </button>
                <button class="btn-small btn-download" onclick="event.stopPropagation(); printResume('${resume.id}')">
                    Print
                </button>
                <button class="btn-small btn-delete" onclick="event.stopPropagation(); deleteResume('${resume.id}')">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

// Function to edit a resume
async function editResume(resumeId) {
    try {
        console.log('Starting edit for resume ID:', resumeId);
        const token = sessionStorage.getItem('authToken');
        console.log('Auth token:', token ? 'Present' : 'Missing');
        
        const response = await fetch(`api.php?endpoint=resumes&id=${resumeId}`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        
        console.log('Response status:', response.status);
        const result = await response.json();
        console.log('API response:', result);
        
        if (result.success && result.data.length > 0) {
            const resume = result.data[0];
            
            // Load resume data into the builder
            window.resumeBuilder.resumeData = {
                id: resume.id,
                title: resume.title,
                personalInfo: resume.personal_info,
                education: resume.education || [],
                experience: resume.experience || [],
                skills: resume.skills || [],
                projects: resume.projects || [],
                achievements: resume.achievements || [],
                template: resume.template || 'modern'
            };
            
            // Populate form and show builder
            window.resumeBuilder.populateForm();
            window.resumeBuilder.updatePreview();
            showResumeBuilder();
            
            // Reset to first step
            window.resumeBuilder.currentStep = 0;
            window.resumeBuilder.showCurrentStep();
            window.resumeBuilder.updateProgressBar();
        }
    } catch (error) {
        console.error('Error loading resume:', error);
        alert('Error loading resume. Please try again.');
    }
}

// Function to print a resume
async function printResume(resumeId) {
    console.log('Starting print for resume:', resumeId);
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch(`api.php?endpoint=resumes&id=${resumeId}`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            const resume = result.data[0];
            
            // Create a temporary resume builder instance with the loaded data
            const tempBuilder = {
                resumeData: {
                    personalInfo: resume.personal_info,
                    education: resume.education || [],
                    experience: resume.experience || [],
                    skills: resume.skills || [],
                    projects: resume.projects || [],
                    achievements: resume.achievements || [],
                    template: resume.template || 'modern'
                },
                generatePDFHTML: function() {
                    const formatDate = (dateString) => {
                        if (!dateString) return '';
                        const date = new Date(dateString + '-01');
                        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                    };

                    return `
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
                                    color: #333;
                                }
                                .resume-container {
                                    max-width: 800px;
                                    margin: 0 auto;
                                }
                                .header {
                                    border-bottom: 3px solid #2563eb;
                                    padding-bottom: 15px;
                                    margin-bottom: 20px;
                                }
                                .name {
                                    font-size: 32px;
                                    font-weight: bold;
                                    color: #1f2937;
                                    margin-bottom: 10px;
                                }
                                .contact-info {
                                    color: #6b7280;
                                    font-size: 14px;
                                    line-height: 1.4;
                                }
                                .section {
                                    margin-bottom: 25px;
                                }
                                .section-title {
                                    font-size: 18px;
                                    font-weight: bold;
                                    color: #1f2937;
                                    margin-bottom: 15px;
                                    border-bottom: 1px solid #d1d5db;
                                    padding-bottom: 5px;
                                }
                                .entry {
                                    margin-bottom: 15px;
                                }
                                .entry-header {
                                    display: flex;
                                    justify-content: space-between;
                                    align-items: flex-start;
                                    margin-bottom: 5px;
                                }
                                .entry-title {
                                    font-size: 16px;
                                    font-weight: 600;
                                    color: #1f2937;
                                    margin: 0;
                                }
                                .entry-date {
                                    color: #6b7280;
                                    font-size: 12px;
                                    white-space: nowrap;
                                }
                                .entry-subtitle {
                                    color: #2563eb;
                                    font-weight: 500;
                                    margin: 0 0 8px 0;
                                    font-size: 14px;
                                }
                                .entry-description {
                                    color: #374151;
                                    line-height: 1.6;
                                    white-space: pre-line;
                                    margin: 0;
                                    font-size: 14px;
                                }
                                .skills-list {
                                    display: flex;
                                    flex-wrap: wrap;
                                    gap: 8px;
                                }
                                .skill-tag {
                                    background-color: #dbeafe;
                                    color: #1e40af;
                                    padding: 4px 12px;
                                    border-radius: 20px;
                                    font-size: 12px;
                                    font-weight: 500;
                                }
                                @media print {
                                    .resume-container {
                                        max-width: none;
                                    }
                                }
                            </style>
                        </head>
                        <body>
                            <div class="resume-container">
                                <div class="header">
                                    <div class="name">${this.resumeData.personalInfo.fullName || 'Your Name'}</div>
                                    <div class="contact-info">
                                        ${this.resumeData.personalInfo.email ? `<div>${this.resumeData.personalInfo.email}</div>` : ''}
                                        ${this.resumeData.personalInfo.phone ? `<div>${this.resumeData.personalInfo.phone}</div>` : ''}
                                        ${this.resumeData.personalInfo.address ? `<div>${this.resumeData.personalInfo.address}</div>` : ''}
                                        ${this.resumeData.personalInfo.linkedIn ? `<div>${this.resumeData.personalInfo.linkedIn}</div>` : ''}
                                        ${this.resumeData.personalInfo.website ? `<div>${this.resumeData.personalInfo.website}</div>` : ''}
                                    </div>
                                </div>

                                ${this.resumeData.personalInfo.summary ? `
                                    <div class="section">
                                        <div class="section-title">Professional Summary</div>
                                        <div class="entry-description">${this.resumeData.personalInfo.summary}</div>
                                    </div>
                                ` : ''}

                                ${this.resumeData.experience.length > 0 ? `
                                    <div class="section">
                                        <div class="section-title">Work Experience</div>
                                        ${this.resumeData.experience.map(exp => `
                                            <div class="entry">
                                                <div class="entry-header">
                                                    <div class="entry-title">${exp.position || 'Position'}</div>
                                                    <div class="entry-date">${formatDate(exp.startDate)} - ${exp.current ? 'Present' : formatDate(exp.endDate)}</div>
                                                </div>
                                                <div class="entry-subtitle">${exp.company}${exp.location ? ` • ${exp.location}` : ''}</div>
                                                <div class="entry-description">${exp.description || ''}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}

                                ${this.resumeData.education.length > 0 ? `
                                    <div class="section">
                                        <div class="section-title">Education</div>
                                        ${this.resumeData.education.map(edu => `
                                            <div class="entry">
                                                <div class="entry-header">
                                                    <div class="entry-title">${edu.degree || 'Degree'} in ${edu.field || 'Field'}</div>
                                                    <div class="entry-date">${formatDate(edu.startDate)} - ${formatDate(edu.endDate)}</div>
                                                </div>
                                                <div class="entry-subtitle">${edu.institution}${edu.gpa ? ` • GPA: ${edu.gpa}` : ''}</div>
                                                ${edu.description ? `<div class="entry-description">${edu.description}</div>` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}

                                ${this.resumeData.projects.length > 0 ? `
                                    <div class="section">
                                        <div class="section-title">Projects</div>
                                        ${this.resumeData.projects.map(project => `
                                            <div class="entry">
                                                <div class="entry-header">
                                                    <div class="entry-title">${project.name || 'Project Name'}</div>
                                                    <div class="entry-date">${formatDate(project.startDate)} - ${project.current ? 'Present' : formatDate(project.endDate)}</div>
                                                </div>
                                                ${project.technologies ? `<div class="entry-subtitle">Technologies: ${project.technologies}</div>` : ''}
                                                ${project.url ? `<div class="entry-subtitle"><a href="${project.url}" target="_blank">View Project</a></div>` : ''}
                                                <div class="entry-description">${project.description || ''}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}

                                ${this.resumeData.skills.filter(skill => skill.trim()).length > 0 ? `
                                    <div class="section">
                                        <div class="section-title">Skills</div>
                                        <div class="skills-list">
                                            ${this.resumeData.skills.filter(skill => skill.trim()).map(skill => `
                                                <span class="skill-tag">${skill}</span>
                                            `).join('')}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </body>
                        </html>
                    `;
                }
            };
            
            // Open print page
            const printWindow = window.open('', '_blank');
            const printContent = tempBuilder.generatePDFHTML();
            
            printWindow.document.write(printContent);
            printWindow.document.close();
            
            // Wait for content to load, then trigger print dialog
            printWindow.onload = function() {
                printWindow.focus();
                printWindow.print();
            };
        } else {
            alert('Resume not found or error loading resume.');
        }
    } catch (error) {
        console.error('Error printing resume:', error);
        alert('Error printing resume. Please try again.');
    }
}

// Function to download a resume (keeping for backward compatibility)
async function downloadResume(resumeId) {
    // Redirect to print function
    return printResume(resumeId);
}

// Function to delete a resume
async function deleteResume(resumeId) {
    if (!confirm('Are you sure you want to delete this resume?')) {
        return;
    }
    
    try {
        const token = sessionStorage.getItem('authToken');
        const response = await fetch('api.php?endpoint=resumes', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ id: resumeId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Resume deleted successfully!');
            loadSavedResumes(); // Refresh the list
        } else {
            alert('Error deleting resume: ' + result.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting resume. Please try again.');
    }
}