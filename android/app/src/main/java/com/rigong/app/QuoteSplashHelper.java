package com.rigong.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.TextView;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import org.json.JSONArray;
import org.json.JSONObject;

public final class QuoteSplashHelper {

    private QuoteSplashHelper() {}

    static void bind(Context context, View overlay) {
        TextView dayBadge = overlay.findViewById(R.id.splash_day_badge);
        TextView quoteView = overlay.findViewById(R.id.splash_quote);
        TextView authorView = overlay.findViewById(R.id.splash_author);

        int dayNum = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
        dayBadge.setText("第 " + dayNum + " 天 / 365");

        Quote quote = loadQuote(context, dayNum);
        quoteView.setText("「" + quote.text + "」");
        if (quote.author != null && !quote.author.isEmpty()) {
            authorView.setText("—— " + quote.author);
            authorView.setVisibility(View.VISIBLE);
        } else {
            authorView.setVisibility(View.GONE);
        }
    }

    private static Quote loadQuote(Context context, int dayNum) {
        SharedPreferences prefs = context.getSharedPreferences(WidgetSyncPlugin.PREFS, Context.MODE_PRIVATE);
        String prefQuote = prefs.getString("quote", "");
        if (prefQuote != null && !prefQuote.isEmpty()) {
            return new Quote(prefQuote, prefs.getString("author", ""));
        }
        return quoteFromAssets(context, dayNum);
    }

    private static Quote quoteFromAssets(Context context, int dayNum) {
        try {
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(context.getAssets().open("quotes.json"), StandardCharsets.UTF_8)
            );
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();
            JSONArray arr = new JSONArray(sb.toString());
            if (arr.length() == 0) {
                return fallback();
            }
            int index = (dayNum - 1) % arr.length();
            JSONObject obj = arr.getJSONObject(index);
            return new Quote(obj.optString("text", ""), obj.optString("author", ""));
        } catch (Exception e) {
            return fallback();
        }
    }

    private static Quote fallback() {
        return new Quote("千里之行，始于足下。", "老子");
    }

    private static final class Quote {
        final String text;
        final String author;

        Quote(String text, String author) {
            this.text = text;
            this.author = author;
        }
    }
}
