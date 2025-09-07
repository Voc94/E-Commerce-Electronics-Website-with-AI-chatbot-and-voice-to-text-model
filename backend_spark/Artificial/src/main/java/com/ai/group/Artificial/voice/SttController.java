package com.ai.group.Artificial.voice;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/voice")
@CrossOrigin(origins = "http://localhost:3000") // frontend dev origin
public class SttController {

    private final SttService stt;

    public SttController(SttService stt) { this.stt = stt; }

    /** POST /api/voice/stt  (multipart) with "audio" = 16k mono PCM16 WAV */
    @PostMapping(value = "/stt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> stt(@RequestPart("audio") MultipartFile audio) throws Exception {
        return stt.transcribe(audio.getBytes());
    }
}
