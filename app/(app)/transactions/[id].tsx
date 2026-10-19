import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { LoadingScreen } from '../../../src/components/loading-screen';
import { TransactionComposer } from '../../../src/components/transaction-composer';
import { TransactionForm } from '../../../src/components/transaction-form';
import { useSession } from '../../../src/data/auth';
import { useToast } from '../../../src/data/toast';
import { useDeleteTransaction, useTransaction, useUpdateTransaction } from '../../../src/data/transactions';
import { colors, spacing, typography } from '../../../src/theme/tokens';

export default function EditTransactionScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useSession();
  const transaction = useTransaction(id);
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const showToast = useToast((state) => state.show);

  function confirmDelete() {
    Alert.alert('Delete this transaction?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void remove.mutateAsync(id).then(
            () => {
              showToast('Transaction deleted');
              router.back();
            },
            () => {
              Alert.alert('Could not delete this transaction');
            },
          );
        },
      },
    ]);
  }

  let body = <LoadingScreen />;
  if (!transaction.isLoading && transaction.isError) {
    body = <Message text="This transaction could not be loaded." />;
  } else if (!transaction.isLoading && !transaction.data) {
    body = <Message text="This transaction is not available." />;
  } else if (transaction.data && transaction.data.created_by !== session?.user.id) {
    body = <Message text="You can only edit your own entries." />;
  } else if (transaction.data) {
    body = (
      <TransactionForm
        title="Edit transaction"
        initial={transaction.data}
        submitting={update.isPending}
        deleting={remove.isPending}
        onDelete={confirmDelete}
        onSubmit={async (input) => {
          await update.mutateAsync({ id, ...input });
          showToast('Transaction saved');
          router.back();
        }}
      />
    );
  }

  return <TransactionComposer>{body}</TransactionComposer>;
}

function Message({ text }: { text: string }) {
  return (
    <View style={styles.message}>
      <Text style={styles.text}>{text}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
        <Text style={styles.closeLabel}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  message: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[24],
    gap: spacing[16],
  },
  text: {
    fontFamily: typography.family[500],
    fontSize: typography.size[15],
    color: colors.ink,
    textAlign: 'center',
  },
  close: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing[12],
  },
  closeLabel: {
    fontFamily: typography.family[700],
    fontSize: typography.size[15],
    color: colors.accent,
  },
});
