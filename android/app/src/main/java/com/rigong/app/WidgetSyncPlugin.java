package com.rigong.app;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetSync")
public class WidgetSyncPlugin extends Plugin {

    public static final String PREFS = "widget_data";

    @PluginMethod
    public void update(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit()
            .putString("quote", call.getString("quote", ""))
            .putString("author", call.getString("author", ""))
            .putString("rankName", call.getString("rankName", "列兵"))
            .putString("rankRange", call.getString("rankRange", "0–3 天"))
            .putInt("streakDays", call.getInt("streakDays", 0))
            .putString("widgetStyle", call.getString("widgetStyle", "classic"))
            .apply();

        DayWidgetProvider.updateAll(ctx);
        call.resolve(new JSObject());
    }
}
