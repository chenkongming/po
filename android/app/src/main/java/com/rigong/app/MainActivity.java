package com.rigong.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private boolean checkinIntentHandled = false;
    private View quoteSplashOverlay;
    private final Handler splashHandler = new Handler(Looper.getMainLooper());
    private boolean quoteSplashHidden = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetSyncPlugin.class);
        super.onCreate(savedInstanceState);
        showQuoteSplashOverlay();
        waitForWebViewAndHideQuoteSplash();
    }

    private void showQuoteSplashOverlay() {
        quoteSplashOverlay = getLayoutInflater().inflate(R.layout.quote_splash_overlay, null);
        QuoteSplashHelper.bind(this, quoteSplashOverlay);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        );
        addContentView(quoteSplashOverlay, params);
    }

    private void waitForWebViewAndHideQuoteSplash() {
        splashHandler.post(new Runnable() {
            @Override
            public void run() {
                if (quoteSplashHidden) return;
                if (getBridge() != null && getBridge().getWebView() != null) {
                    getBridge().getWebView().evaluateJavascript(
                        "(function(){return document.readyState==='complete'})()",
                        value -> {
                            if ("true".equals(String.valueOf(value))) {
                                hideQuoteSplashOverlay();
                            } else {
                                splashHandler.postDelayed(this, 80);
                            }
                        }
                    );
                } else {
                    splashHandler.postDelayed(this, 50);
                }
            }
        });
    }

    private void hideQuoteSplashOverlay() {
        if (quoteSplashHidden || quoteSplashOverlay == null) return;
        quoteSplashHidden = true;
        quoteSplashOverlay.animate()
            .alpha(0f)
            .setDuration(220)
            .withEndAction(() -> {
                if (quoteSplashOverlay != null) {
                    quoteSplashOverlay.setVisibility(View.GONE);
                }
            })
            .start();
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
