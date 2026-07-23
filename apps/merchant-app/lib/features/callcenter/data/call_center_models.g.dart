// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'call_center_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CallsTodayImpl _$$CallsTodayImplFromJson(Map<String, dynamic> json) =>
    _$CallsTodayImpl(
      total: (json['total'] as num?)?.toInt() ?? 0,
      byStatus: (json['by_status'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, e as num),
          ) ??
          const <String, num>{},
    );

Map<String, dynamic> _$$CallsTodayImplToJson(_$CallsTodayImpl instance) =>
    <String, dynamic>{
      'total': instance.total,
      'by_status': instance.byStatus,
    };

_$CallCenterDashboardImpl _$$CallCenterDashboardImplFromJson(
        Map<String, dynamic> json) =>
    _$CallCenterDashboardImpl(
      tenantId: json['tenant_id'] as String? ?? "",
      callsToday: json['calls_today'] == null
          ? const CallsToday()
          : CallsToday.fromJson(json['calls_today'] as Map<String, dynamic>),
      totalMinutes: json['total_minutes'] as num? ?? 0,
      totalCost: json['total_cost'] as num? ?? 0,
      tasksScheduled: (json['tasks_scheduled'] as num?)?.toInt() ?? 0,
      campaignsRunning: (json['campaigns_running'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$CallCenterDashboardImplToJson(
        _$CallCenterDashboardImpl instance) =>
    <String, dynamic>{
      'tenant_id': instance.tenantId,
      'calls_today': instance.callsToday,
      'total_minutes': instance.totalMinutes,
      'total_cost': instance.totalCost,
      'tasks_scheduled': instance.tasksScheduled,
      'campaigns_running': instance.campaignsRunning,
    };

_$CallAgentImpl _$$CallAgentImplFromJson(Map<String, dynamic> json) =>
    _$CallAgentImpl(
      id: json['id'] as String? ?? "",
      name: json['name'] as String? ?? "",
      useCase: json['use_case'] as String? ?? "",
      status: json['status'] as String? ?? "",
      currentVersionId: json['current_version_id'] as String?,
    );

Map<String, dynamic> _$$CallAgentImplToJson(_$CallAgentImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'use_case': instance.useCase,
      'status': instance.status,
      'current_version_id': instance.currentVersionId,
    };

_$CallPhoneNumberImpl _$$CallPhoneNumberImplFromJson(
        Map<String, dynamic> json) =>
    _$CallPhoneNumberImpl(
      id: json['id'] as String? ?? "",
      e164: json['e164'] as String? ?? "",
      provider: json['provider'] as String? ?? "",
      providerNumberId: json['provider_number_id'] as String?,
      country: json['country'] as String?,
      agentId: json['agent_id'] as String?,
      label: json['label'] as String?,
      active: json['active'] as bool? ?? true,
      createdAt: json['created_at'] as String?,
    );

Map<String, dynamic> _$$CallPhoneNumberImplToJson(
        _$CallPhoneNumberImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'e164': instance.e164,
      'provider': instance.provider,
      'provider_number_id': instance.providerNumberId,
      'country': instance.country,
      'agent_id': instance.agentId,
      'label': instance.label,
      'active': instance.active,
      'created_at': instance.createdAt,
    };

_$CallTranscriptTurnImpl _$$CallTranscriptTurnImplFromJson(
        Map<String, dynamic> json) =>
    _$CallTranscriptTurnImpl(
      role: json['role'] as String? ?? "",
      content: json['content'] as String? ?? "",
    );

Map<String, dynamic> _$$CallTranscriptTurnImplToJson(
        _$CallTranscriptTurnImpl instance) =>
    <String, dynamic>{
      'role': instance.role,
      'content': instance.content,
    };

_$CallCenterCallImpl _$$CallCenterCallImplFromJson(Map<String, dynamic> json) =>
    _$CallCenterCallImpl(
      id: json['id'] as String? ?? "",
      status: json['status'] as String? ?? "",
      direction: json['direction'] as String? ?? "outbound",
      fromNumber: json['from_number'] as String?,
      toNumber: json['to_number'] as String?,
      orderId: json['order_id'] as String?,
      campaignId: json['campaign_id'] as String?,
      disposition: json['disposition'] as String?,
      sentiment: json['sentiment'] as String?,
      costTotal: json['cost_total'] as num?,
      startedAt: json['started_at'] as String?,
      endedAt: json['ended_at'] as String?,
      createdAt: json['created_at'] as String? ?? "",
      summary: json['summary'] as String?,
      transcript: (json['transcript'] as List<dynamic>?)
          ?.map((e) => CallTranscriptTurn.fromJson(e as Map<String, dynamic>))
          .toList(),
      recordingUrl: json['recording_url'] as String?,
      locale: json['locale'] as String?,
    );

Map<String, dynamic> _$$CallCenterCallImplToJson(
        _$CallCenterCallImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': instance.status,
      'direction': instance.direction,
      'from_number': instance.fromNumber,
      'to_number': instance.toNumber,
      'order_id': instance.orderId,
      'campaign_id': instance.campaignId,
      'disposition': instance.disposition,
      'sentiment': instance.sentiment,
      'cost_total': instance.costTotal,
      'started_at': instance.startedAt,
      'ended_at': instance.endedAt,
      'created_at': instance.createdAt,
      'summary': instance.summary,
      'transcript': instance.transcript,
      'recording_url': instance.recordingUrl,
      'locale': instance.locale,
    };

_$CallDispositionImpl _$$CallDispositionImplFromJson(
        Map<String, dynamic> json) =>
    _$CallDispositionImpl(
      id: json['id'] as String? ?? "",
      outcome: json['outcome'] as String? ?? "",
      reason: json['reason'] as String?,
      notes: json['notes'] as String?,
      setBy: json['set_by'] as String?,
      createdAt: json['created_at'] as String? ?? "",
    );

Map<String, dynamic> _$$CallDispositionImplToJson(
        _$CallDispositionImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'outcome': instance.outcome,
      'reason': instance.reason,
      'notes': instance.notes,
      'set_by': instance.setBy,
      'created_at': instance.createdAt,
    };

_$CallAgentRefImpl _$$CallAgentRefImplFromJson(Map<String, dynamic> json) =>
    _$CallAgentRefImpl(
      id: json['id'] as String? ?? "",
      name: json['name'] as String? ?? "",
    );

Map<String, dynamic> _$$CallAgentRefImplToJson(_$CallAgentRefImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
    };

_$CallOrderRefImpl _$$CallOrderRefImplFromJson(Map<String, dynamic> json) =>
    _$CallOrderRefImpl(
      id: json['id'] as String? ?? "",
      displayId: (json['display_id'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$CallOrderRefImplToJson(_$CallOrderRefImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'display_id': instance.displayId,
    };

_$CallDetailImpl _$$CallDetailImplFromJson(Map<String, dynamic> json) =>
    _$CallDetailImpl(
      callData: CallCenterCall.fromJson(json['call'] as Map<String, dynamic>),
      dispositions: (json['dispositions'] as List<dynamic>?)
              ?.map((e) => CallDisposition.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <CallDisposition>[],
      agent: json['agent'] == null
          ? null
          : CallAgentRef.fromJson(json['agent'] as Map<String, dynamic>),
      order: json['order'] == null
          ? null
          : CallOrderRef.fromJson(json['order'] as Map<String, dynamic>),
      hasRecording: json['has_recording'] as bool? ?? false,
    );

Map<String, dynamic> _$$CallDetailImplToJson(_$CallDetailImpl instance) =>
    <String, dynamic>{
      'call': instance.callData,
      'dispositions': instance.dispositions,
      'agent': instance.agent,
      'order': instance.order,
      'has_recording': instance.hasRecording,
    };

_$CallAnalyticsSummaryImpl _$$CallAnalyticsSummaryImplFromJson(
        Map<String, dynamic> json) =>
    _$CallAnalyticsSummaryImpl(
      total: (json['total'] as num?)?.toInt() ?? 0,
      connectRate: json['connect_rate'] as num? ?? 0,
      containmentRate: json['containment_rate'] as num? ?? 0,
      avgHandleTime: json['avg_handle_time'] as num? ?? 0,
      totalCost: json['total_cost'] as num? ?? 0,
    );

Map<String, dynamic> _$$CallAnalyticsSummaryImplToJson(
        _$CallAnalyticsSummaryImpl instance) =>
    <String, dynamic>{
      'total': instance.total,
      'connect_rate': instance.connectRate,
      'containment_rate': instance.containmentRate,
      'avg_handle_time': instance.avgHandleTime,
      'total_cost': instance.totalCost,
    };

_$CallDayPointImpl _$$CallDayPointImplFromJson(Map<String, dynamic> json) =>
    _$CallDayPointImpl(
      date: json['date'] as String? ?? "",
      count: (json['count'] as num?)?.toInt() ?? 0,
      cost: json['cost'] as num? ?? 0,
    );

Map<String, dynamic> _$$CallDayPointImplToJson(_$CallDayPointImpl instance) =>
    <String, dynamic>{
      'date': instance.date,
      'count': instance.count,
      'cost': instance.cost,
    };

_$CallCenterAnalyticsImpl _$$CallCenterAnalyticsImplFromJson(
        Map<String, dynamic> json) =>
    _$CallCenterAnalyticsImpl(
      summary: json['summary'] == null
          ? const CallAnalyticsSummary()
          : CallAnalyticsSummary.fromJson(
              json['summary'] as Map<String, dynamic>),
      outcomes: (json['outcomes'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, e as num),
          ) ??
          const <String, num>{},
      byStatus: (json['by_status'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, e as num),
          ) ??
          const <String, num>{},
      byDay: (json['by_day'] as List<dynamic>?)
              ?.map((e) => CallDayPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <CallDayPoint>[],
      sentiment: (json['sentiment'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, e as num),
          ) ??
          const <String, num>{},
      kpisNote: json['kpis_note'] as String? ?? "",
    );

Map<String, dynamic> _$$CallCenterAnalyticsImplToJson(
        _$CallCenterAnalyticsImpl instance) =>
    <String, dynamic>{
      'summary': instance.summary,
      'outcomes': instance.outcomes,
      'by_status': instance.byStatus,
      'by_day': instance.byDay,
      'sentiment': instance.sentiment,
      'kpis_note': instance.kpisNote,
    };

_$PhoneNumbersResultImpl _$$PhoneNumbersResultImplFromJson(
        Map<String, dynamic> json) =>
    _$PhoneNumbersResultImpl(
      phoneNumbers: (json['phone_numbers'] as List<dynamic>?)
              ?.map((e) => CallPhoneNumber.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <CallPhoneNumber>[],
      providers: (json['providers'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, e as bool),
          ) ??
          const <String, bool>{},
      monthlyCredits: json['monthly_credits'] as num? ?? 0,
    );

Map<String, dynamic> _$$PhoneNumbersResultImplToJson(
        _$PhoneNumbersResultImpl instance) =>
    <String, dynamic>{
      'phone_numbers': instance.phoneNumbers,
      'providers': instance.providers,
      'monthly_credits': instance.monthlyCredits,
    };
