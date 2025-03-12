BEGIN KeypadSecuritySystem

    INITIALIZE Constants:
        DEBOUNCE_TIME = 50 ms
        CONFIRMATION_THRESHOLD = 500 ms
        INPUT_TIMEOUT = 10000 ms
        LOCKOUT_DURATION = 200 ms
        SECURITY_LOCKOUT = 60000 ms
        SUCCESS_UNLOCK_TIME = 5000 ms
        MAX_CODE_LENGTH = 8
        MAX_FAILED_ATTEMPTS = 3

    INITIALIZE State Variables:
        currentSum = 0
        buttonStates = [0, 0, 0, 0]
        buttonPressStartTimes = [0, 0, 0, 0]
        codeBuffer = []
        storedCode = [3, 12, 1]  // Predefined security code
        failedAttempts = 0
        inputStartTime = 0
        systemState = "IDLE"
        timeoutId = NULL

    INITIALIZE UI Elements:
        buttons = GET all keypad buttons
        statusLed = GET status LED
        errorLed = GET error LED
        successLed = GET success LED
        statusDisplay = GET status area
        digits = GET display digits

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
        SET buttonStates[buttonIndex] TO 1 (Pressed)
        HIGHLIGHT button as "pressed-shallow"

        INCREMENT currentSum BY button's value
        UPDATE nibble display

        IF systemState IS "IDLE":
            SET systemState TO "INPUT_ACTIVE"
            START input timeout countdown

        START deep press detection TIMER:
            AFTER CONFIRMATION_THRESHOLD (500 ms):
                IF button is still pressed:
                    CONFIRM button press (deep press)
                    CONFIRM sum and ADD to codeBuffer

    FUNCTION handleButtonRelease(buttonIndex, button):
        RESET buttonStates[buttonIndex] TO 0
        REMOVE visual press effects

    FUNCTION setSystemState(newState):
        DISPLAY state change
        UPDATE LEDs according to newState:
            "IDLE" -> Blink status LED
            "INPUT_ACTIVE" -> Fast blink status LED
            "CONFIRMATION" -> Status LED ON
            "LOCKOUT" -> Error LED ON, wait, then reset state
            "SECURITY_LOCKOUT" -> Lock system for SECURITY_LOCKOUT duration

    FUNCTION confirmSum():
        IF currentSum IS 0:
            DISPLAY "Invalid input"
            RETURN

        ADD currentSum TO codeBuffer
        RESET currentSum
        UPDATE nibble display

        IF codeBuffer LENGTH == storedCode LENGTH:
            VALIDATE entered code
        ELSE:
            SET systemState TO "LOCKOUT"

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
        RESET LEDs and display
        IF NOT success LED active:
            SET systemState TO "IDLE"

    FUNCTION log(message):
        DISPLAY timestamped message in status area

    FUNCTION arraysEqual(a, b):
        COMPARE arrays element-wise
        RETURN true IF all elements match, else false

    CALL initialize()

END KeypadSecuritySystem
