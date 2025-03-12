BEGIN LetterKeypadSecuritySystem

    INITIALIZE Constants:
        DEBOUNCE_TIME = 50 ms
        CONFIRMATION_THRESHOLD = 500 ms
        INPUT_TIMEOUT = 10000 ms
        LOCKOUT_DURATION = 200 ms
        SECURITY_LOCKOUT = 60000 ms
        SUCCESS_UNLOCK_TIME = 5000 ms
        MAX_CODE_LENGTH = 8
        MAX_FAILED_ATTEMPTS = 3
        MULTI_PRESS_WINDOW = 300 ms  // Time window to detect simultaneous presses

    INITIALIZE State Variables:
        activeButtons = []  // Track currently active buttons
        buttonStates = [false, false, false, false]  // A, B, C, D
        buttonPressStartTimes = [0, 0, 0, 0]
        lastPressTime = 0  // For tracking multi-button presses
        codeBuffer = []
        storedCode = ["A", "BC", "D"]  // Predefined security code using button combinations
        failedAttempts = 0
        inputStartTime = 0
        systemState = "IDLE"
        timeoutId = NULL

    INITIALIZE Input Mapping:
        inputMap = {
            "A": "A",
            "B": "B", 
            "C": "C",
            "D": "D",
            "AB": "AB",
            "AC": "AC", 
            "AD": "AD",
            "BC": "BC",
            "BD": "BD",
            "CD": "CD"
        }

    INITIALIZE UI Elements:
        buttons = GET all keypad buttons (A, B, C, D)
        statusLed = GET status LED
        errorLed = GET error LED
        successLed = GET success LED
        statusDisplay = GET status area
        displayArea = GET code display area

    FUNCTION initialize():
        DISPLAY "System initialized"
        SET systemState TO "IDLE"
        START status LED blink

        FOR EACH button IN buttons:
            SET event listeners for "mousedown", "mouseup", "touchstart", "touchend"

    FUNCTION handleButtonPress(buttonIndex, button):
        IF systemState IS "LOCKOUT" OR "SECURITY_LOCKOUT":
            RETURN

        RECORD buttonPressStartTimes[buttonIndex] AS CURRENT TIME
        SET buttonStates[buttonIndex] TO true
        HIGHLIGHT button as "pressed"
        
        // Add button to active buttons
        ADD button label TO activeButtons
        
        IF systemState IS "IDLE":
            SET systemState TO "INPUT_ACTIVE"
            SET lastPressTime TO CURRENT TIME
            START input timeout countdown
        ELSE:
            // Check if this is within the multi-press window of another button
            IF (CURRENT TIME - lastPressTime) <= MULTI_PRESS_WINDOW:
                // Consider this part of a multi-button press
            ELSE:
                // This is a new input sequence
                IF activeButtons.length > 0:
                    processButtonCombination()
                
                SET lastPressTime TO CURRENT TIME
        
        START confirmation TIMER:
            AFTER CONFIRMATION_THRESHOLD (500 ms):
                IF button is still pressed AND activeButtons.length > 0:
                    processButtonCombination()

    FUNCTION handleButtonRelease(buttonIndex, button):
        SET buttonStates[buttonIndex] TO false
        REMOVE visual press effects
        
        // If all buttons are released and there was an active combination
        IF all buttonStates are false AND activeButtons.length > 0:
            // Wait a short delay to ensure no more buttons are being pressed
            START TIMER:
                AFTER MULTI_PRESS_WINDOW:
                    IF all buttonStates are still false:
                        processButtonCombination()

    FUNCTION processButtonCombination():
        // Sort the active buttons alphabetically
        SORT activeButtons
        
        // Join the button labels to form a combination (e.g., "AB", "C", etc.)
        combination = JOIN activeButtons
        
        IF combination exists in inputMap:
            // Valid combination
            ADD combination TO codeBuffer
            UPDATE display to show entered combinations
            
            IF codeBuffer LENGTH == storedCode LENGTH:
                VALIDATE entered code
            ELSE:
                SET systemState TO "LOCKOUT" for brief moment before accepting next input
        ELSE:
            // Invalid combination
            DISPLAY "Invalid button combination"
            ACTIVATE error LED briefly
        
        // Reset active buttons
        CLEAR activeButtons

    FUNCTION setSystemState(newState):
        DISPLAY state change
        UPDATE LEDs according to newState:
            "IDLE" -> Blink status LED
            "INPUT_ACTIVE" -> Fast blink status LED
            "CONFIRMATION" -> Status LED ON
            "LOCKOUT" -> Error LED ON, wait, then reset state
            "SECURITY_LOCKOUT" -> Lock system for SECURITY_LOCKOUT duration

    FUNCTION validateCode():
        IF codeBuffer MATCHES storedCode:
            DISPLAY "Access Granted"
            ACTIVATE success LED
            RESET failedAttempts
            UNLOCK system for SUCCESS_UNLOCK_TIME
        ELSE:
            DISPLAY "Access Denied"
            ACTIVATE error LED
            INCREMENT failedAttempts
            IF failedAttempts >= MAX_FAILED_ATTEMPTS:
                SET systemState TO "SECURITY_LOCKOUT"
            ELSE:
                RESET system after brief lockout

    FUNCTION resetSystem():
        CLEAR codeBuffer
        CLEAR activeButtons
        RESET LEDs and display
        IF NOT success LED active:
            SET systemState TO "IDLE"

    FUNCTION log(message):
        DISPLAY timestamped message in status area

    FUNCTION arraysEqual(a, b):
        COMPARE arrays element-wise
        RETURN true IF all elements match, else false

    CALL initialize()

END LetterKeypadSecuritySystem