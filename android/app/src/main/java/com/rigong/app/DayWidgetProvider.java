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
        String quote = prefs.getString("quote", "打开 365.dev 开始今天");
        String author = prefs.getString("author", "");
        int dayNum = prefs.getInt("dayNum", 1);
        boolean checkedIn = prefs.getBoolean("checkedIn", false);
        String statusLabel = prefs.getString("statusLabel", "未打卡");
        int streakDays = prefs.getInt("streakDays", 0);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_day);
        views.setTextViewText(R.id.widget_day_badge, "第 " + dayNum + " 天 / 365");
        views.setTextViewText(R.id.widget_quote, quote);
        views.setTextViewText(
            R.id.widget_author,
            author.isEmpty() ? "" : "—— " + author
        );
        views.setViewVisibility(R.id.widget_author, author.isEmpty() ? android.view.View.GONE : android.view.View.VISIBLE);
        String streakPart = streakDays > 0 ? "连续 " + streakDays + " 天 · " : "";
        views.setTextViewText(
            R.id.widget_status,
            streakPart + (checkedIn ? "今日已打卡 · " + statusLabel : "今日未打卡")
        );

        Intent intent = new Intent(context, MainActivity.class);
        intent.putExtra("open_checkin", true);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        views.setOnClickPendingIntent(R.id.widget_action, pending);

        manager.updateAppWidget(widgetId, views);
    }
}
