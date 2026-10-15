package com.eduvia.eduvia

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.widget.RemoteViews
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider

/**
 * Home-screen widget: a child's attendance today and the next fee due. The app writes the values (HomeWidget.saveWidgetData)
 * each time Home loads; tapping the widget opens the app.
 */
class TodayWidgetProvider : HomeWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray, widgetData: SharedPreferences) {
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.today_widget).apply {
                setTextViewText(R.id.widget_child, widgetData.getString("child", null) ?: "Vidyanexa")
                setTextViewText(R.id.widget_attendance, widgetData.getString("attendance", null) ?: "Open the app to see today")
                setTextViewText(R.id.widget_fee, widgetData.getString("fee", null) ?: "")
                setTextViewText(R.id.widget_updated, widgetData.getString("updated", null) ?: "")
                setOnClickPendingIntent(R.id.widget_root, HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java))
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }
}
