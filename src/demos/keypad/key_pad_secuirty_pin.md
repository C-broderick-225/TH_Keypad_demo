BEGIN SimplePinSecuritySystem

    INITIALIZE Constants:
        DEBOUNCE_TIME = 50 ms
        INPUT_TIMEOUT = 10000 ms
        LOCKOUT_DURATION = 200 ms
        SECURITY_LOCKOUT = 60000 ms
        SUCCESS_UNLOCK_TIME = 5000 ms
        MAX_CODE_LENGTH = 8
        MAX_FAILED_ATTEMPTS = 3

    INITIALIZE State Variables:
        codeBuffer = []
        storedCode = [1, 3, 2, 4]  // Predefined security code
        failedAttempts = 0
        inputStartTime = 0
        systemState = "IDLE"
        timeoutId = NULL

    INITIALIZE UI Elements:
        buttons = GET all keypad buttons (1, 2, 3, 4)
        statusLed = GET status LED
        errorLed = GET error LED
        successLed = GET success LED
        statusDisplay = GET status area
        pinDisplay = GET PIN display area

    FUNCTION initialize():
        DISPLAY "System initialized"
        SET systemState TO "IDLE"
        START status LED blink

        FOR EACH button IN buttons:
            SET event listeners for "click", "touchend"

    FUNCTION handleButtonPress(buttonValue):
        IF systemState IS "LOCKOUT" OR "SECURITY_LOCKOUT":
            RETURN

        HIGHLIGHT button as "pressed"
        
        // Add digit to code buffer
        ADD buttonValue TO codeBuffer
        UPDATE pinDisplay with masked input (e.g., "****" for 4 digits)
        
        IF systemState IS "IDLE":
            SET systemState TO "INPUT_ACTIVE"
            SET inputStartTime TO CURRENT TIME
            START input timeout countdown
        
        // Check if we've reached the expected code length
        IF codeBuffer LENGTH == storedCode LENGTH:
            validateCode()
        
        // Visual feedback for button press
        AFTER 100 ms:
            REMOVE "pressed" highlight

    FUNCTION setSystemState(newState):
        DISPLAY state change
        UPDATE LEDs according to newState:
            "IDLE" -> Blink status LED
            "INPUT_ACTIVE" -> Fast blink status LED
            "LOCKOUT" -> Error LED ON, wait, then reset state
            "SECURITY_LOCKOUT" -> Lock system for SECURITY_LOCKOUT duration

    FUNCTION validateCode():
        IF codeBuffer MATCHES storedCode:
            DISPLAY "Access Granted"
            ACTIVATE success LED
            RESET failedAttempts
            UNLOCK system for SUCCESS_UNLOCK_TIME
            AFTER SUCCESS_UNLOCK_TIME:
                resetSystem()
        ELSE:
            DISPLAY "Access Denied"
            ACTIVATE error LED
            INCREMENT failedAttempts
            IF failedAttempts >= MAX_FAILED_ATTEMPTS:
                SET systemState TO "SECURITY_LOCKOUT"
                AFTER SECURITY_LOCKOUT:
                    resetSystem()
            ELSE:
                AFTER LOCKOUT_DURATION:
                    resetSystem()

    FUNCTION resetSystem():
        CLEAR codeBuffer
        RESET LEDs and display
        IF NOT success LED active:
            SET systemState TO "IDLE"

    FUNCTION handleInputTimeout():
        IF systemState IS "INPUT_ACTIVE":
            IF codeBuffer LENGTH > 0:
                DISPLAY "Input timeout"
                ACTIVATE error LED briefly
            resetSystem()

    FUNCTION log(message):
        DISPLAY timestamped message in status area

    FUNCTION arraysEqual(a, b):
        COMPARE arrays element-wise
        RETURN true IF all elements match, else false

    FUNCTION clearInput():
        CLEAR codeBuffer
        UPDATE pinDisplay to show no input

    CALL initialize()

END SimplePinSecuritySystem