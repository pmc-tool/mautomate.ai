// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'billing_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$BillingPlanImpl _$$BillingPlanImplFromJson(Map<String, dynamic> json) =>
    _$BillingPlanImpl(
      key: json['key'] as String? ?? "",
      name: json['name'] as String? ?? "",
      priceUsd: json['price_usd'] as num? ?? 0,
      includedCredits: json['included_credits'] as num? ?? 0,
      productsLimit: json['products_limit'] as num?,
      seatsLimit: json['seats_limit'] as num?,
      domainsLimit: json['domains_limit'] as num?,
    );

Map<String, dynamic> _$$BillingPlanImplToJson(_$BillingPlanImpl instance) =>
    <String, dynamic>{
      'key': instance.key,
      'name': instance.name,
      'price_usd': instance.priceUsd,
      'included_credits': instance.includedCredits,
      'products_limit': instance.productsLimit,
      'seats_limit': instance.seatsLimit,
      'domains_limit': instance.domainsLimit,
    };

_$BillingUsageRowImpl _$$BillingUsageRowImplFromJson(
        Map<String, dynamic> json) =>
    _$BillingUsageRowImpl(
      action: json['action'] as String? ?? "",
      label: json['label'] as String? ?? "",
      units: json['units'] as num? ?? 0,
      credits: json['credits'] as num? ?? 0,
    );

Map<String, dynamic> _$$BillingUsageRowImplToJson(
        _$BillingUsageRowImpl instance) =>
    <String, dynamic>{
      'action': instance.action,
      'label': instance.label,
      'units': instance.units,
      'credits': instance.credits,
    };

_$BillingPackImpl _$$BillingPackImplFromJson(Map<String, dynamic> json) =>
    _$BillingPackImpl(
      credits: (json['credits'] as num?)?.toInt() ?? 0,
      amountUsd: json['amount_usd'] as num? ?? 0,
      bonusPct: json['bonus_pct'] as num? ?? 0,
    );

Map<String, dynamic> _$$BillingPackImplToJson(_$BillingPackImpl instance) =>
    <String, dynamic>{
      'credits': instance.credits,
      'amount_usd': instance.amountUsd,
      'bonus_pct': instance.bonusPct,
    };

_$CreditBucketsImpl _$$CreditBucketsImplFromJson(Map<String, dynamic> json) =>
    _$CreditBucketsImpl(
      total: json['total'] as num? ?? 0,
      expiring: json['expiring'] as num? ?? 0,
      purchased: json['purchased'] as num? ?? 0,
      nextExpiry: json['next_expiry'] as String?,
    );

Map<String, dynamic> _$$CreditBucketsImplToJson(_$CreditBucketsImpl instance) =>
    <String, dynamic>{
      'total': instance.total,
      'expiring': instance.expiring,
      'purchased': instance.purchased,
      'next_expiry': instance.nextExpiry,
    };

_$WalletImpl _$$WalletImplFromJson(Map<String, dynamic> json) => _$WalletImpl(
      balance: json['balance'] as num? ?? 0,
      reserved: json['reserved'] as num? ?? 0,
    );

Map<String, dynamic> _$$WalletImplToJson(_$WalletImpl instance) =>
    <String, dynamic>{
      'balance': instance.balance,
      'reserved': instance.reserved,
    };

_$AllowanceImpl _$$AllowanceImplFromJson(Map<String, dynamic> json) =>
    _$AllowanceImpl(
      included: json['included'] as num? ?? 0,
      usedThisCycle: json['used_this_cycle'] as num? ?? 0,
      cycleStart: json['cycle_start'] as String?,
    );

Map<String, dynamic> _$$AllowanceImplToJson(_$AllowanceImpl instance) =>
    <String, dynamic>{
      'included': instance.included,
      'used_this_cycle': instance.usedThisCycle,
      'cycle_start': instance.cycleStart,
    };

_$GatewayInfoImpl _$$GatewayInfoImplFromJson(Map<String, dynamic> json) =>
    _$GatewayInfoImpl(
      configured: json['configured'] as bool? ?? false,
      name: json['name'] as String?,
    );

Map<String, dynamic> _$$GatewayInfoImplToJson(_$GatewayInfoImpl instance) =>
    <String, dynamic>{
      'configured': instance.configured,
      'name': instance.name,
    };

_$BillingOverviewImpl _$$BillingOverviewImplFromJson(
        Map<String, dynamic> json) =>
    _$BillingOverviewImpl(
      creditUsd: json['credit_usd'] as num? ?? 0.01,
      planStatus: json['plan_status'] as String? ?? "",
      trialEndsAt: json['trial_ends_at'] as String?,
      credits: json['credits'] == null
          ? null
          : CreditBuckets.fromJson(json['credits'] as Map<String, dynamic>),
      wallet: json['wallet'] == null
          ? const Wallet()
          : Wallet.fromJson(json['wallet'] as Map<String, dynamic>),
      currentPlan: json['current_plan'] == null
          ? null
          : BillingPlan.fromJson(json['current_plan'] as Map<String, dynamic>),
      plans: (json['plans'] as List<dynamic>?)
              ?.map((e) => BillingPlan.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <BillingPlan>[],
      allowance: json['allowance'] == null
          ? const Allowance()
          : Allowance.fromJson(json['allowance'] as Map<String, dynamic>),
      usage: (json['usage'] as List<dynamic>?)
              ?.map((e) => BillingUsageRow.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <BillingUsageRow>[],
      packs: (json['packs'] as List<dynamic>?)
              ?.map((e) => BillingPack.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <BillingPack>[],
      gateway: json['gateway'] == null
          ? const GatewayInfo()
          : GatewayInfo.fromJson(json['gateway'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$BillingOverviewImplToJson(
        _$BillingOverviewImpl instance) =>
    <String, dynamic>{
      'credit_usd': instance.creditUsd,
      'plan_status': instance.planStatus,
      'trial_ends_at': instance.trialEndsAt,
      'credits': instance.credits,
      'wallet': instance.wallet,
      'current_plan': instance.currentPlan,
      'plans': instance.plans,
      'allowance': instance.allowance,
      'usage': instance.usage,
      'packs': instance.packs,
      'gateway': instance.gateway,
    };

_$CreditTransactionImpl _$$CreditTransactionImplFromJson(
        Map<String, dynamic> json) =>
    _$CreditTransactionImpl(
      id: json['id'] as String? ?? "",
      kind: json['kind'] as String?,
      label: json['label'] as String?,
      type: json['type'] as String?,
      amount: json['amount'] as num? ?? 0,
      createdAt: json['created_at'] as String? ?? "",
    );

Map<String, dynamic> _$$CreditTransactionImplToJson(
        _$CreditTransactionImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': instance.kind,
      'label': instance.label,
      'type': instance.type,
      'amount': instance.amount,
      'created_at': instance.createdAt,
    };

_$CreditsHistoryImpl _$$CreditsHistoryImplFromJson(Map<String, dynamic> json) =>
    _$CreditsHistoryImpl(
      balance: json['balance'] as num? ?? 0,
      transactions: (json['transactions'] as List<dynamic>?)
              ?.map(
                  (e) => CreditTransaction.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <CreditTransaction>[],
      count: (json['count'] as num?)?.toInt() ?? 0,
      hasMore: json['has_more'] as bool? ?? false,
      limit: (json['limit'] as num?)?.toInt() ?? 0,
      offset: (json['offset'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$$CreditsHistoryImplToJson(
        _$CreditsHistoryImpl instance) =>
    <String, dynamic>{
      'balance': instance.balance,
      'transactions': instance.transactions,
      'count': instance.count,
      'has_more': instance.hasMore,
      'limit': instance.limit,
      'offset': instance.offset,
    };
