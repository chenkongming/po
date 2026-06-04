package com.rigong.app;

import android.content.Intent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private boolean checkinIntentHandled = false;

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(WidgetSyncPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        checkinIntentHandled = false;
        dispatchCheckinIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        dispatchCheckinIntent(getIntent());
    }

    private void dispatchCheckinIntent(Intent intent) {
        if (checkinIntentHandled || intent == null || !intent.getBooleanExtra("open_checkin", false)) {
            return;
        }
        if (getBridge() == null || getBridge().getWebView() == null) {
            return;
        }
        checkinIntentHandled = true;
        intent.removeExtra("open_checkin");
        getBridge().getWebView().postDelayed(
            () -> getBridge().eval("window.dispatchEvent(new Event('app-open-checkin'))", null),
            500
        );
    }
}
