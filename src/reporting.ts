import { Alert, Platform } from 'react-native';
import { supabase } from './lib/supabase';

export type ReportTarget = 'profile' | 'tasting' | 'comment' | 'cheese';

const common = [
  { code: 'harassment', label: 'Harassment or bullying' },
  { code: 'hate', label: 'Hate or abusive content' },
  { code: 'spam', label: 'Spam or misleading content' },
  { code: 'privacy', label: 'Privacy or impersonation' },
  { code: 'illegal', label: 'Illegal or dangerous activity' },
];

const reasons: Record<ReportTarget, { code: string; label: string }[]> = {
  profile: common,
  tasting: [{ code: 'off_topic', label: 'Not cheese-related' }, ...common],
  comment: [{ code: 'off_topic', label: 'Off-topic or disruptive' }, ...common],
  cheese: [
    { code: 'incorrect', label: 'Incorrect cheese information' },
    { code: 'duplicate', label: 'Duplicate cheese entry' },
    { code: 'rights', label: 'Photo or trademark concern' },
    { code: 'unsafe', label: 'Unsafe or inappropriate content' },
  ],
};

export function chooseReportReason(reporterId: string, targetType: ReportTarget, targetId: string) {
  if (!supabase) return Alert.alert('Sign in required', 'Sign in to report content or accounts.');
  const submit = async (reason: { code: string; label: string }) => {
    const { error } = await supabase!.from('reports').insert({
      reporter_id: reporterId,
      target_type: targetType,
      target_id: targetId,
      reason_code: reason.code,
      reason: reason.label,
    });
    if (error) return Alert.alert('Could not submit report', error.message);
    Alert.alert('Report received', 'An administrator will review it. Thank you for helping protect the community.');
  };
  const available = reasons[targetType];
  if (Platform.OS === 'android' && available.length > 2) {
    const showGroup = (title: string, group: typeof available) => Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...group.slice(0, group.length > 2 ? 1 : 2).map((reason) => ({ text: reason.label, onPress: () => submit(reason) })),
      ...(group.length > 2 ? [{ text: 'More reasons…', onPress: () => showGroup(title, group.slice(1)) }] : []),
    ]);
    showGroup('Why are you reporting this?', available);
    return;
  }
  Alert.alert(
    'Why are you reporting this?',
    'Choose the reason that best matches the concern.',
    [
      { text: 'Cancel', style: 'cancel' },
      ...reasons[targetType].map((reason) => ({
        text: reason.label,
        onPress: () => submit(reason),
      })),
    ],
  );
}
