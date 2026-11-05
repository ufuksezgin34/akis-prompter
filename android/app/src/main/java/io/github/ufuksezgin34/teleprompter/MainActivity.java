package io.github.ufuksezgin34.teleprompter;

import android.os.Bundle;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RemoteKeysPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        RemoteKeysPlugin plugin = RemoteKeysPlugin.instance;
        if (plugin != null && plugin.handle(event)) return true;
        return super.dispatchKeyEvent(event);
    }
}
