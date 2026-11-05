package io.github.ufuksezgin34.teleprompter;

import android.view.KeyEvent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bluetooth kumandalardan gelen ses ve medya tuşlarını web katmanına iletir.
 * Yakalama yalnızca okuma ekranı veya tuş öğrenme ekranı açıkken etkindir;
 * diğer zamanlarda ses tuşları normal şekilde sistem sesini değiştirir.
 */
@CapacitorPlugin(name = "RemoteKeys")
public class RemoteKeysPlugin extends Plugin {
    static RemoteKeysPlugin instance;
    private volatile boolean capture = false;

    @Override
    public void load() {
        instance = this;
    }

    @PluginMethod
    public void setCapture(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        capture = enabled != null && enabled;
        call.resolve();
    }

    static String keyName(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_VOLUME_UP: return "VolumeUp";
            case KeyEvent.KEYCODE_VOLUME_DOWN: return "VolumeDown";
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:
            case KeyEvent.KEYCODE_HEADSETHOOK: return "MediaPlayPause";
            case KeyEvent.KEYCODE_MEDIA_PLAY: return "MediaPlay";
            case KeyEvent.KEYCODE_MEDIA_PAUSE: return "MediaPause";
            case KeyEvent.KEYCODE_MEDIA_NEXT: return "MediaTrackNext";
            case KeyEvent.KEYCODE_MEDIA_PREVIOUS: return "MediaTrackPrevious";
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD: return "MediaFastForward";
            case KeyEvent.KEYCODE_MEDIA_REWIND: return "MediaRewind";
            default: return null;
        }
    }

    /** true dönerse olay tüketilir (sistem ses düzeyi değişmez). */
    boolean handle(KeyEvent event) {
        if (!capture) return false;
        String name = keyName(event.getKeyCode());
        if (name == null) return false;
        if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
            JSObject data = new JSObject();
            data.put("key", name);
            notifyListeners("key", data);
        }
        return true;
    }
}
