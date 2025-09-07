package com.ai.group.Artificial.voice;

import javax.sound.sampled.*;
import java.io.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

public class WavUtil {

    /** Read 16 kHz mono 16-bit PCM (little-endian) WAV into [-1,1] floats. */
    public static float[] readPcm16Mono16k(InputStream in) throws Exception {
        try (AudioInputStream ais0 = AudioSystem.getAudioInputStream(new BufferedInputStream(in))) {
            AudioFormat f = ais0.getFormat();
            if (!(f.getChannels() == 1 &&
                    (int) f.getSampleRate() == 16000 &&
                    f.getSampleSizeInBits() == 16 &&
                    !f.isBigEndian() &&
                    f.getEncoding().equals(AudioFormat.Encoding.PCM_SIGNED))) {
                throw new IllegalArgumentException("Expect 16 kHz mono 16-bit PCM LE WAV");
            }
            byte[] bytes = ais0.readAllBytes();
            int samples = bytes.length / 2;
            float[] out = new float[samples];
            ByteBuffer bb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
            for (int i = 0; i < samples; i++) {
                short s = bb.getShort();
                out[i] = Math.max(-1f, Math.min(1f, s / 32768f));
            }
            return out;
        }
    }
}
