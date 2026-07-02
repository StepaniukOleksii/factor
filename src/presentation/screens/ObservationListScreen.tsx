import React, {useEffect, useState} from 'react';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    SafeAreaView,
    StatusBar as RNStatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {GetObservationsUseCase, ObservationListItem} from '../../application/GetObservationsUseCase';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {SQLiteRecordRepository} from '../../infrastructure/SQLiteRecordRepository';

const repository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const useCase = new GetObservationsUseCase(repository, recordRepository);

const COLORS = {
    background: '#131313',
    surface: '#131313',
    onSurface: '#e5e2e1',
    onSurfaceVariant: '#c2c9b9',
    surfaceContainerLowest: '#0e0e0e',
    surfaceContainerLow: '#1c1b1b',
    surfaceContainerHighest: '#353534',
    outlineVariant: '#42493d',
    outline: '#8c9385',
    primaryContainer: '#b6f09c',
    onPrimaryContainer: '#3c6f2a',
    primary: '#f9fff0',
    onPrimary: '#0b3900',
    onPrimaryFixedVariant: '#205110',
    error: '#ffb4ab',
};

export interface ObservationListScreenProps {
    onCreateNew: () => void;
    onCreateRecord: (observationId: string) => void;
    onObservationSelected: (observationId: string) => void;
}

export function ObservationListScreen({
                                          onCreateNew,
                                          onCreateRecord,
                                          onObservationSelected
                                      }: ObservationListScreenProps) {
    const [observations, setObservations] = useState<ObservationListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadObservations();
    }, []);

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
            <TouchableOpacity
                style={styles.card}
                onPress={() => onObservationSelected(item.observation.id)}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <View style={styles.cardContent}>
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
                    </View>
                    <TouchableOpacity
                        style={styles.cardAddButton}
                        onPress={() => onCreateRecord(item.observation.id)}
                    >
                        <MaterialIcons name="add" size={24} color={COLORS.primaryContainer}/>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
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
        <SafeAreaView style={styles.safeArea}>
            {/* TopAppBar */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Observations</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primaryContainer}/>
                </View>
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
            <TouchableOpacity style={styles.fab} onPress={onCreateNew}>
                <MaterialIcons name="add" size={24} color={COLORS.onPrimaryContainer}/>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
        paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
    },
    header: {
        height: 64,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.outlineVariant,
        backgroundColor: COLORS.background,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '500',
        color: COLORS.primary,
    },
    listContent: {
        padding: 16,
        paddingBottom: 100, // For FAB
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        borderRadius: 12,
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
        borderRadius: 16,
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
        borderRadius: 4,
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
        borderRadius: 12,
        backgroundColor: COLORS.primaryContainer,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
