package com.rigong.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;
import android.appwidget.AppWidgetProvider;

public class DayWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, manager, id);
        }
    }

    static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context, DayWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id : ids) {
            updateWidget(context, manager, id);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences prefs = context.getSharedPreferences(WidgetSyncPlugin.PREFS, Context.MODE_PRIVATE);
        String rankName = prefs.getString("rankName", "列兵");
        String rankRange = prefs.getString("rankRange", "0–3 天");
        int streakDays = prefs.getInt("streakDays", 0);
        String style = prefs.getString("widgetStyle", "classic");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_day);
        views.setTextViewText(R.id.widget_rank_name, rankName);
        views.setTextViewText(R.id.widget_streak_days, String.valueOf(streakDays));
        views.setTextViewText(R.id.widget_rank_range, rankRange);
        applyWidgetStyle(context, views, style);

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pending);

        manager.updateAppWidget(widgetId, views);
    }

    private static void applyWidgetStyle(Context context, RemoteViews views, String style) {
        int bgRes;
        int textPrimary;
        int textSecondary;
        int accent;

        switch (style) {
            case "minimal":
                bgRes = R.drawable.widget_bg_minimal;
                textPrimary = R.color.widget_minimal_text_primary;
                textSecondary = R.color.widget_minimal_text_secondary;
                accent = R.color.widget_minimal_accent;
                break;
            case "dark":
                bgRes = R.drawable.widget_bg_dark;
                textPrimary = R.color.widget_dark_text_primary;
                textSecondary = R.color.widget_dark_text_secondary;
                accent = R.color.widget_dark_accent;
                break;
            case "accent":
                bgRes = R.drawable.widget_bg_accent;
                textPrimary = R.color.widget_accent_text_primary;
                textSecondary = R.color.widget_accent_text_secondary;
                accent = R.color.widget_accent_accent;
                break;
            case "outline":
                bgRes = R.drawable.widget_bg_outline;
                textPrimary = R.color.widget_outline_text_primary;
                textSecondary = R.color.widget_outline_text_secondary;
                accent = R.color.widget_outline_accent;
                break;
            case "classic":
            default:
                bgRes = R.drawable.widget_bg_classic;
                textPrimary = R.color.widget_classic_text_primary;
                textSecondary = R.color.widget_classic_text_secondary;
                accent = R.color.widget_classic_accent;
                break;
        }

        views.setInt(R.id.widget_root, "setBackgroundResource", bgRes);
        views.setTextColor(R.id.widget_rank_name, context.getColor(textPrimary));
        views.setTextColor(R.id.widget_streak_days, context.getColor(accent));
        views.setTextColor(R.id.widget_rank_range, context.getColor(textSecondary));
    }
}
