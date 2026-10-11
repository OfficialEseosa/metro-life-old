package app.lagoslife;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Every error leaves the API as {"error": "..."} with a matching status code. */
@RestControllerAdvice
public class ErrorHandler {
    private static final Logger log = LoggerFactory.getLogger(ErrorHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, String>> api(ApiException e) {
        return body(e.status(), e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, String>> invalid(MethodArgumentNotValidException e) {
        var fe = e.getBindingResult().getFieldError();
        return body(400, fe != null && fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid request");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, String>> unreadable(HttpMessageNotReadableException e) {
        return body(400, "Invalid request body");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> other(Exception e) {
        if (e instanceof ErrorResponse er) {
            HttpStatusCode code = er.getStatusCode();
            String msg = switch (code.value()) {
                case 404 -> "Not found";
                case 405 -> "Method not allowed";
                case 415 -> "Unsupported media type";
                default -> code.is4xxClientError() ? "Bad request" : "Server error";
            };
            return body(code.value(), msg);
        }
        log.error("Unhandled error", e);
        return body(500, "Server error");
    }

    private static ResponseEntity<Map<String, String>> body(int status, String message) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(Map.of("error", message));
    }
}
