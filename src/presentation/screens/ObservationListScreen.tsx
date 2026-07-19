import React, {useCallback, useState} from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {GetObservationsUseCase, ObservationListItem} from '../../application/GetObservationsUseCase';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {SQLiteRecordRepository} from '../../infrastructure/SQLiteRecordRepository';
import {CenteredState, ScreenContainer, ScreenHeader} from "@presentation/components";
import {COLORS, RADIUS} from "@presentation/theme";
import type {RootStackParamList} from '../navigation/routes';

const repository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const useCase = new GetObservationsUseCase(repository, recordRepository);

export type ObservationListScreenProps = NativeStackScreenProps<RootStackParamList, 'ObservationList'>;

export function ObservationListScreen({navigation}: ObservationListScreenProps) {
    const [observations, setObservations] = useState<ObservationListItem[]>([]);
    const [loading, setLoading] = useState(true);

    // As the stack's root this screen stays mounted for the whole session, so a
    // mount effect would only ever fire once. Reloading on focus is what keeps
    // an Observation created, deleted, or recorded against above it from
    // leaving the list showing what it showed on launch (ADR-2).
    useFocusEffect(
        useCallback(() => {
            loadObservations();
        }, []),
    );

    const loadObservations = async () => {
        try {
            setLoading(true);
            const data = await useCase.execute();
            setObservations(data);
        } catch (error) {
            console.error('Failed to load observations', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({item}: { item: ObservationListItem }) => {
        const visibleMetrics = item.observation.metrics.slice(0, 3);
        const hiddenMetricsCount = item.observation.metrics.length - 3;

        const timeText = item.lastRecordAt
            ? `Last record: ${item.lastRecordAt.toLocaleString()}`
            : 'No records yet';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <TouchableOpacity
                        style={styles.cardContent}
                        onPress={() => navigation.navigate('ObservationDetails', {observationId: item.observation.id})}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.cardTitle}>{item.observation.name}</Text>
                        <View style={styles.metricsRow}>
                            {visibleMetrics.map(metric => (
                                <View key={metric.id} style={styles.metricChip}>
                                    <Text style={styles.metricChipText}>{metric.name}</Text>
                                </View>
                            ))}
                            {hiddenMetricsCount > 0 && (
                                <View style={styles.metricChip}>
                                    <Text style={[styles.metricChipText, styles.metricChipTextDim]}>
                                        +{hiddenMetricsCount}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.lastRecordText}>{timeText}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.cardAddButton}
                        onPress={() => navigation.navigate('CreateRecord', {observationId: item.observation.id})}
                    >
                        <MaterialIcons name="add" size={24} color={COLORS.primaryContainer}/>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const renderEmptyComponent = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No observations created yet.</Text>
                <Text style={styles.emptySubText}>Tap the + button to create one.</Text>
            </View>
        );
    };

    return (
        <ScreenContainer>
            <ScreenHeader title="Observations"/>

            {loading ? (
                <CenteredState/>
            ) : (
                <FlatList
                    data={observations}
                    keyExtractor={item => item.observation.id}
                    renderItem={renderItem}
                    ListEmptyComponent={renderEmptyComponent}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {/* FAB */}
            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateObservation')}>
                <MaterialIcons name="add" size={24} color={COLORS.onPrimaryContainer}/>
            </TouchableOpacity>
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    listContent: {
        padding: 16,
        paddingBottom: 100, // For FAB
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: COLORS.onSurface,
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
    emptySubText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 14,
    },
    card: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.lg,
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    cardContent: {
        flex: 1,
        marginRight: 16,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: 4,
    },
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    metricChip: {
        backgroundColor: COLORS.surfaceContainerHighest,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: RADIUS.xl,
    },
    metricChipText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 12,
    },
    metricChipTextDim: {
        opacity: 0.7,
    },
    lastRecordText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 12,
        opacity: 0.7,
        marginTop: 8,
    },
    cardAddButton: {
        width: 32,
        height: 32,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.primaryContainer,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fab: {
        position: 'absolute',
        bottom: 96,
        right: 16,
        width: 56,
        height: 56,
        borderRadius: RADIUS.lg,
        backgroundColor: COLORS.primaryContainer,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
