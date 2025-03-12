class RetroKeypadSystem {
    constructor() {
        // Constants
        this.DEBOUNCE_TIME = 50;
        this.CONFIRMATION_THRESHOLD = 500;
        this.INPUT_TIMEOUT = 30000;
        this.LOCKOUT_DURATION = 200;
        this.SECURITY_LOCKOUT = 60000;
        this.SUCCESS_UNLOCK_TIME = 5000;
        this.MAX_CODE_LENGTH = 8;
        this.MAX_FAILED_ATTEMPTS = 3;

        // Audio setup
        this.setupAudio();

        // System state
        this.STATES = {
            IDLE: 'IDLE',
            INPUT_ACTIVE: 'INPUT_ACTIVE',
            CONFIRMATION: 'CONFIRMATION',
            LOCKOUT: 'LOCKOUT',
            SECURITY_LOCKOUT: 'SECURITY_LOCKOUT'
        };

        // Initialize variables
        this.currentNibble = 0;
        this.buttonStates = [0, 0, 0, 0];
        this.codeBuffer = [];
        this.storedCode = [3, 12, 1, 9, 3, 7];
        this.failedAttempts = 0;
        this.inputStartTime = 0;
        this.systemState = this.STATES.IDLE;
        this.pressStartTimes = new Map();
        this.timeoutHandle = null;
        this.activeKeys = new Set();
        this.keyConfirmationTimer = null;

        // DOM elements
        this.statusLed = document.getElementById('statusLed');
        this.errorLed = document.getElementById('errorLed');
        this.successLed = document.getElementById('successLed');
        this.codeDisplay = document.getElementById('codeDisplay');
        this.statusDisplay = document.getElementById('statusDisplay');

        this.initializeButtons();
        this.initializeKeyboard();
        this.startStatusBlink();
        this.displayBootSequence();
    }

    setupAudio() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        this.beep = (frequency, duration, volume = 0.1, type = 'square') => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.type = type;
            oscillator.frequency.value = frequency;
            gainNode.gain.value = volume;

            oscillator.start();
            setTimeout(() => {
                oscillator.stop();
            }, duration);
        };
    }

    initializeKeyboard() {
        // Key mapping for buttons (1-4 keys)
        this.keyMap = {
            '1': 1,
            '2': 2,
            '3': 4,
            '4': 8
        };

        document.addEventListener('keydown', (e) => {
            if (this.systemState === this.STATES.SECURITY_LOCKOUT || 
                this.systemState === this.STATES.LOCKOUT) {
                this.beep(110, 100, 0.1, 'sawtooth');
                return;
            }

            const key = e.key;
            
            // Handle number keys 1-4
            if (this.keyMap[key] && !this.activeKeys.has(key)) {
                this.activeKeys.add(key);
                const value = this.keyMap[key];
                const buttonIndex = Math.log2(value);
                const button = document.querySelector(`[data-value="${value}"]`);
                
                // Visual feedback
                button.classList.add('pressed');
                
                // Button press sound
                this.beep(440 + (buttonIndex * 100), 50);

                // Update current nibble
                this.currentNibble |= value;
                this.updateDisplay();

                // Start deep press detection for key hold
                if (!this.keyConfirmationTimer) {
                    this.keyConfirmationTimer = setTimeout(() => {
                        if (this.activeKeys.size > 0) {  // If any keys are still held
                            this.handleDeepPress(0);
                            // Add deep-press visual feedback to all active buttons
                            this.activeKeys.forEach(activeKey => {
                                const activeValue = this.keyMap[activeKey];
                                const activeButton = document.querySelector(`[data-value="${activeValue}"]`);
                                activeButton.classList.add('deep-pressed');
                            });
                        }
                    }, this.CONFIRMATION_THRESHOLD);
                }

                // If first input, change state to INPUT_ACTIVE
                if (this.systemState === this.STATES.IDLE) {
                    this.systemState = this.STATES.INPUT_ACTIVE;
                    this.inputStartTime = Date.now();
                    this.startInputTimeout();
                }
            }
            
            // Handle spacebar for confirmation
            if (key === ' ' && this.currentNibble > 0) {
                this.handleDeepPress(0); // Using 0 as a generic button index
            }
        });

        document.addEventListener('keyup', (e) => {
            const key = e.key;
            if (this.keyMap[key]) {
                this.activeKeys.delete(key);
                const value = this.keyMap[key];
                const button = document.querySelector(`[data-value="${value}"]`);
                button.classList.remove('pressed', 'deep-pressed');

                // Clear key confirmation timer if no keys are pressed
                if (this.activeKeys.size === 0) {
                    if (this.keyConfirmationTimer) {
                        clearTimeout(this.keyConfirmationTimer);
                        this.keyConfirmationTimer = null;
                    }
                }
            }
        });
    }

    initializeButtons() {
        const buttons = document.querySelectorAll('.button');
        buttons.forEach(button => {
            button.addEventListener('mousedown', (e) => this.handleButtonPress(e));
            button.addEventListener('mouseup', (e) => this.handleButtonRelease(e));
            button.addEventListener('mouseleave', (e) => this.handleButtonRelease(e));
        });
    }

    async displayBootSequence() {
        const messages = [
            'INITIALIZING...',
            'LOADING SECURITY PROTOCOLS...',
            'CALIBRATING INPUT MATRIX...',
            'SYSTEM READY'
        ];

        this.codeDisplay.style.color = '#0f0';
        for (let msg of messages) {
            this.codeDisplay.textContent = msg;
            this.beep(440, 50);
            await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        this.codeDisplay.textContent = 'ENTER CODE:';
        this.beep(880, 100);
    }

    handleButtonPress(e) {
        if (this.systemState === this.STATES.SECURITY_LOCKOUT || 
            this.systemState === this.STATES.LOCKOUT) {
            this.beep(110, 100, 0.1, 'sawtooth');
            return;
        }

        const button = e.target;
        const value = parseInt(button.dataset.value);
        const buttonIndex = Math.log2(value);

        // Record press start time for deep press detection
        this.pressStartTimes.set(buttonIndex, Date.now());

        // Set shallow press state
        this.buttonStates[buttonIndex] = 1;
        button.classList.add('pressed');

        // Start deep press detection
        const deepPressTimeout = setTimeout(() => {
            if (this.pressStartTimes.has(buttonIndex)) {
                this.handleDeepPress(buttonIndex);
                button.classList.add('deep-pressed');
            }
        }, this.CONFIRMATION_THRESHOLD);

        // Button press sound
        this.beep(440 + (buttonIndex * 100), 50);

        // Update current nibble
        this.currentNibble |= value;
        this.updateDisplay();

        // If first input, change state to INPUT_ACTIVE
        if (this.systemState === this.STATES.IDLE) {
            this.systemState = this.STATES.INPUT_ACTIVE;
            this.inputStartTime = Date.now();
            this.startInputTimeout();
        }
    }

    handleButtonRelease(e) {
        const button = e.target;
        const value = parseInt(button.dataset.value);
        const buttonIndex = Math.log2(value);

        // Clear press tracking
        this.pressStartTimes.delete(buttonIndex);
        this.buttonStates[buttonIndex] = 0;
        
        // Remove visual states
        button.classList.remove('pressed', 'deep-pressed');
    }

    handleDeepPress(buttonIndex) {
        if (this.systemState !== this.STATES.INPUT_ACTIVE) return;

        // Confirm current nibble
        if (this.currentNibble > 0) {
            this.codeBuffer.push(this.currentNibble);
            
            // Confirmation sounds and visuals
            this.beep(880, 100, 0.1);
            this.flashStatusLed();
            this.flashConfirmationLed();
            
            // Check if we have a complete code
            if (this.codeBuffer.length === this.storedCode.length) {
                this.validateCode();
            } else {
                // Prepare for next nibble
                this.currentNibble = 0;
                this.systemState = this.STATES.LOCKOUT;
                setTimeout(() => {
                    this.systemState = this.STATES.INPUT_ACTIVE;
                }, this.LOCKOUT_DURATION);
            }
        }

        this.updateDisplay();
    }

    validateCode() {
        const isValid = this.codeBuffer.every((value, index) => value === this.storedCode[index]);

        if (isValid) {
            this.handleSuccessfulEntry();
        } else {
            this.handleFailedEntry();
        }

        // Reset for next attempt
        this.codeBuffer = [];
        this.currentNibble = 0;
        this.systemState = this.STATES.IDLE;
    }

    handleSuccessfulEntry() {
        this.failedAttempts = 0;
        this.successLed.classList.add('green');
        this.statusDisplay.textContent = '>> ACCESS GRANTED <<';
        this.statusDisplay.style.color = '#0f0';
        
        // Success sound sequence
        this.beep(440, 100);
        setTimeout(() => this.beep(660, 100), 100);
        setTimeout(() => this.beep(880, 200), 200);

        setTimeout(() => {
            this.successLed.classList.remove('green');
            this.statusDisplay.textContent = '';
            this.updateDisplay();
        }, this.SUCCESS_UNLOCK_TIME);
    }

    handleFailedEntry() {
        this.failedAttempts++;
        this.errorLed.classList.add('red');
        this.statusDisplay.textContent = '!! ACCESS DENIED !!';
        this.statusDisplay.style.color = '#f00';

        // Error sound sequence
        this.beep(220, 200, 0.1, 'sawtooth');
        setTimeout(() => this.beep(110, 400, 0.1, 'sawtooth'), 200);

        if (this.failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
            this.systemState = this.STATES.SECURITY_LOCKOUT;
            this.statusDisplay.textContent = '!!! SYSTEM LOCKED !!!';
            
            // Lockout alarm sound
            const playAlarm = () => {
                this.beep(440, 200, 0.1, 'sawtooth');
                setTimeout(() => this.beep(220, 200, 0.1, 'sawtooth'), 200);
            };
            playAlarm();
            const alarmInterval = setInterval(playAlarm, 2000);
            
            setTimeout(() => {
                clearInterval(alarmInterval);
                this.systemState = this.STATES.IDLE;
                this.failedAttempts = 0;
                this.errorLed.classList.remove('red');
                this.statusDisplay.textContent = '';
                this.updateDisplay();
            }, this.SECURITY_LOCKOUT);
        } else {
            setTimeout(() => {
                this.errorLed.classList.remove('red');
                this.statusDisplay.textContent = '';
                this.updateDisplay();
            }, 2000);
        }
    }

    startInputTimeout() {
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
        }

        this.timeoutHandle = setTimeout(() => {
            if (this.systemState === this.STATES.INPUT_ACTIVE) {
                this.currentNibble = 0;
                this.codeBuffer = [];
                this.systemState = this.STATES.IDLE;
                this.updateDisplay();
                this.beep(220, 100, 0.1);
            }
        }, this.INPUT_TIMEOUT);
    }

    updateDisplay() {
        let displayText = 'ENTER CODE: ';
        
        if (this.codeBuffer.length > 0) {
            displayText += this.codeBuffer.join('-');
            if (this.currentNibble > 0) {
                displayText += '-';
            }
        }

        if (this.currentNibble > 0) {
            displayText += this.currentNibble;
        }

        if (this.systemState === this.STATES.INPUT_ACTIVE) {
            displayText += '_';
        }

        this.codeDisplay.textContent = displayText;
    }

    flashStatusLed() {
        this.statusLed.classList.add('blue');
        setTimeout(() => {
            this.statusLed.classList.remove('blue');
        }, 200);
    }

    flashConfirmationLed() {
        this.successLed.classList.add('green');
        setTimeout(() => {
            this.successLed.classList.remove('green');
        }, 200);
    }

    startStatusBlink() {
        setInterval(() => {
            if (this.systemState === this.STATES.IDLE) {
                this.statusLed.classList.toggle('blue');
            }
        }, 1000);
    }
}

// Initialize the keypad system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RetroKeypadSystem();
}); 