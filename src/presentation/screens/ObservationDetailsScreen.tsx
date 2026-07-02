import React, {useEffect, useState} from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StatusBar as RNStatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {SQLiteRecordRepository} from '../../infrastructure/SQLiteRecordRepository';
import {GetObservationByIdUseCase} from '../../application/GetObservationByIdUseCase';
import {GetRecentRecordsUseCase} from '../../application/GetRecentRecordsUseCase';
import {DeleteObservationUseCase} from '../../application/DeleteObservationUseCase';
import {Observation} from '../../domain/Observation';
import {Record as DomainRecord} from '../../domain/Record';

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const getObservationByIdUseCase = new GetObservationByIdUseCase(observationRepository);
const getRecentRecordsUseCase = new GetRecentRecordsUseCase(recordRepository);
const deleteObservationUseCase = new DeleteObservationUseCase(observationRepository, recordRepository);

const COLORS = {
    background: '#131313',
    surface: '#131313',
    onSurface: '#e5e2e1',
    onSurfaceVariant: '#c2c9b9',
    surfaceContainerLowest: '#0e0e0e',
    surfaceContainerHighest: '#262626',
    surfaceContainerHigh: '#2a2a2a',
    surfaceContainerLow: '#1c1b1b',
    outlineVariant: '#42493d',
    outline: '#8c9385',
    primaryContainer: '#b6f09c',
    onPrimaryFixedVariant: '#205110',
    primary: '#f9fff0',
    onPrimary: '#0b3900',
    error: '#ffb4ab',
    onError: '#690005',
};

export interface ObservationDetailsScreenProps {
    observationId: string;
    onBack: () => void;
    onCreateRecord: () => void;
    onDeleted: () => void;
}

function formatRelativeTime(date: Date): string {
    const now = new Date();
    const timeStr = date.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today.getTime() - targetDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `Today, ${timeStr}`;
    if (diffDays === 1) return `Yesterday, ${timeStr}`;
    if (diffDays > 1 && diffDays < 7) {
        return `${date.toLocaleDateString([], {weekday: 'short'})}, ${timeStr}`;
    }
    return `${date.toLocaleDateString([], {month: 'short', day: 'numeric'})}, ${timeStr}`;
}

export function ObservationDetailsScreen({
                                             observationId,
                                             onBack,
                                             onCreateRecord,
                                             onDeleted
                                         }: ObservationDetailsScreenProps) {
    const [observation, setObservation] = useState<Observation | null>(null);
    const [records, setRecords] = useState<DomainRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
    const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
    const [contentWidths, setContentWidths] = useState<Record<string, number>>({});
    const [scrollViewWidths, setScrollViewWidths] = useState<Record<string, number>>({});
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadData();
    }, [observationId]);

    const loadData = async () => {
        try {
            setLoading(true);
            const obs = await getObservationByIdUseCase.execute(observationId);
            setObservation(obs);
            if (obs) {
                const recentRecords = await getRecentRecordsUseCase.execute(observationId, 3);
                setRecords(recentRecords);
            }
        } catch (error) {
            console.error('Failed to load observation details', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (recordId: string) => {
        setExpandedRecordId(prev => prev === recordId ? null : recordId);
    };

    const handleMenuPress = () => {
        setMenuVisible(prev => !prev);
    };

    const handleDeleteMenuItemPress = () => {
        setMenuVisible(false);
        setDeleteModalVisible(true);
    };

    const handleCancelDelete = () => {
        setDeleteModalVisible(false);
    };

    const handleConfirmDelete = async () => {
        try {
            setDeleting(true);
            await deleteObservationUseCase.execute(observationId);
            setDeleteModalVisible(false);
            onDeleted();
        } catch (error) {
            console.error('Failed to delete observation', error);
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.primary}/>
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primaryContainer}/>
                </View>
            </SafeAreaView>
        );
    }

    if (!observation) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={24} color={COLORS.primary}/>
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <Text style={{color: COLORS.onSurface}}>Observation not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color={COLORS.primary}/>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{observation.name}</Text>

                {/* Kebab Menu */}
                <View style={styles.menuContainer}>
                    <TouchableOpacity
                        onPress={handleMenuPress}
                        style={styles.menuButton}
                        accessibilityLabel="More options"
                    >
                        <MaterialIcons name="more-vert" size={24} color={COLORS.onSurface}/>
                    </TouchableOpacity>

                    {menuVisible && (
                        <>
                            {/* Backdrop to close the menu on outside tap */}
                            <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}/>
                            <View style={styles.menuDropdown}>
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={handleDeleteMenuItemPress}
                                    accessibilityLabel="Delete observation"
                                >
                                    <MaterialIcons name="delete" size={20} color={COLORS.error}/>
                                    <Text style={styles.menuItemTextDestructive}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Metrics Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>METRICS</Text>
                    <View style={styles.metricsRow}>
                        {observation.metrics.map(metric => (
                            <View key={metric.id} style={styles.metricChip}>
                                <View style={styles.metricDot}/>
                                <Text style={styles.metricChipText}>{metric.name}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Recent Records Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>RECENT RECORDS</Text>
                    {records.length === 0 ? (
                        <Text style={styles.emptyText}>No records yet.</Text>
                    ) : (
                        <View style={styles.recordsList}>
                            {records.map(record => {
                                const isExpanded = expandedRecordId === record.id;
                                return (
                                    <View key={record.id}
                                          style={[styles.recordCard, isExpanded && styles.recordCardExpanded]}>
                                        <TouchableOpacity
                                            style={styles.recordHeader}
                                            onPress={() => toggleExpand(record.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.recordHeaderLeft}>
                                                <MaterialIcons name="schedule" size={16} color={COLORS.onSurfaceVariant}
                                                               style={styles.timeIcon}/>
                                                <Text
                                                    style={styles.recordTimeText}>{formatRelativeTime(record.timestamp)}</Text>
                                            </View>
                                            <MaterialIcons
                                                name={isExpanded ? "expand-less" : "chevron-right"}
                                                size={24}
                                                color={COLORS.onSurfaceVariant}
                                            />
                                        </TouchableOpacity>

                                        {isExpanded && (
                                            <View style={styles.recordDetailsContainer}>
                                                <ScrollView
                                                    horizontal
                                                    showsHorizontalScrollIndicator={false}
                                                    style={styles.horizontalScroll}
                                                    scrollEventThrottle={16}
                                                    onLayout={(e) => {
                                                        const width = e.nativeEvent.layout.width;
                                                        setScrollViewWidths(prev => ({...prev, [record.id]: width}));
                                                    }}
                                                    onContentSizeChange={(w) => {
                                                        setContentWidths(prev => ({...prev, [record.id]: w}));
                                                    }}
                                                    onScroll={(e) => {
                                                        const offsetX = e.nativeEvent.contentOffset.x;
                                                        setScrollPositions(prev => ({...prev, [record.id]: offsetX}));
                                                    }}
                                                >
                                                    {observation.metrics.map((metric, index) => {
                                                        const val = record.values.get(metric.id);
                                                        const displayVal = val !== undefined && val !== null ? String(val) : '-';
                                                        return (
                                                            <View key={metric.id}
                                                                  style={[styles.metricValueBlock, index === observation.metrics.length - 1 && styles.metricValueBlockLast]}>
                                                                <Text
                                                                    style={styles.metricValueLabel}>{metric.name.toUpperCase()}</Text>
                                                                <Text style={styles.metricValueText}>{displayVal}</Text>
                                                            </View>
                                                        );
                                                    })}
                                                </ScrollView>

                                                {/* Custom Scrollbar */}
                                                <View style={styles.scrollbarContainer}>
                                                    <MaterialIcons name="arrow-left" size={16}
                                                                   color={COLORS.outlineVariant}/>
                                                    <View style={styles.scrollbarTrack}>
                                                        {(() => {
                                                            const sw = scrollViewWidths[record.id] || 1;
                                                            const cw = contentWidths[record.id] || 1;
                                                            const sp = scrollPositions[record.id] || 0;

                                                            if (cw <= sw) return null; // No need for thumb if content fits

                                                            const ratio = sw / cw;
                                                            const thumbWidth = (Math.max(ratio * 100, 20) + '%') as `${number}%`;

                                                            const maxScroll = cw - sw;
                                                            const scrollProgress = maxScroll > 0 ? sp / maxScroll : 0;
                                                            const maxThumbOffset = 100 - parseFloat(thumbWidth);
                                                            const thumbOffset = ((scrollProgress * maxThumbOffset) + '%') as `${number}%`;

                                                            return (
                                                                <View style={[styles.scrollbarThumb, {
                                                                    width: thumbWidth,
                                                                    left: thumbOffset
                                                                }]}/>
                                                            );
                                                        })()}
                                                    </View>
                                                    <MaterialIcons name="arrow-right" size={16}
                                                                   color={COLORS.outlineVariant}/>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

            </ScrollView>

            {/* Footer / Add Record Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={onCreateRecord}
                >
                    <Text style={styles.saveButtonText}>Add Record</Text>
                    <MaterialIcons name="check" size={20} color={COLORS.onPrimaryFixedVariant}/>
                </TouchableOpacity>
            </View>

            {/* Delete Confirmation Modal */}
            <Modal
                visible={deleteModalVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={handleCancelDelete}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalTextGroup}>
                            <Text style={styles.modalTitle}>Delete Observation?</Text>
                            <Text style={styles.modalBody}>
                                Are you sure you want to delete this observation and all its records? This action cannot
                                be undone.
                            </Text>
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={handleCancelDelete}
                                disabled={deleting}
                                accessibilityLabel="Cancel deletion"
                            >
                                <Text style={styles.modalCancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalDeleteButton, deleting && styles.modalDeleteButtonDisabled]}
                                onPress={handleConfirmDelete}
                                disabled={deleting}
                                accessibilityLabel="Confirm deletion"
                            >
                                <Text style={styles.modalDeleteButtonText}>
                                    {deleting ? 'Deleting…' : 'Delete'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.outlineVariant,
        backgroundColor: COLORS.surface,
        zIndex: 40,
    },
    backButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: 48,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.primary,
        flex: 1,
        textAlign: 'center',
    },
    menuContainer: {
        width: 48,
        alignItems: 'flex-end',
        position: 'relative',
        zIndex: 50,
    },
    menuButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    menuBackdrop: {
        position: 'absolute',
        top: -1000,
        left: -1000,
        right: -1000,
        bottom: -1000,
        zIndex: 49,
    },
    menuDropdown: {
        position: 'absolute',
        top: 44,
        right: 0,
        width: 192,
        backgroundColor: COLORS.surfaceContainerHigh,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        overflow: 'hidden',
        zIndex: 50,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuItemTextDestructive: {
        color: COLORS.error,
        fontSize: 14,
        fontWeight: '500',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: 24,
        paddingBottom: 120,
    },
    section: {
        marginBottom: 40,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.onSurfaceVariant,
        letterSpacing: 1,
        marginBottom: 16,
    },
    metricsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    metricChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceContainerLow,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.surfaceContainerHighest,
    },
    metricDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primaryContainer,
        marginRight: 8,
    },
    metricChipText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    recordsList: {
        gap: 12,
    },
    emptyText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 14,
    },
    recordCard: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surfaceContainerHighest,
        paddingBottom: 12,
        marginBottom: 4,
    },
    recordCardExpanded: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderBottomWidth: 0,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        paddingBottom: 0,
        marginBottom: 12,
        overflow: 'hidden',
    },
    recordHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
    },
    recordHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeIcon: {
        marginRight: 8,
    },
    recordTimeText: {
        color: COLORS.onSurface,
        fontSize: 14,
        fontWeight: '500',
    },
    recordDetailsContainer: {
        paddingTop: 8,
        paddingBottom: 16,
        paddingHorizontal: 8,
    },
    horizontalScroll: {
        flexDirection: 'row',
    },
    metricValueBlock: {
        backgroundColor: COLORS.surfaceContainerLowest,
        borderRadius: 8,
        padding: 12,
        marginRight: 8,
        minWidth: 100,
    },
    metricValueBlockLast: {
        marginRight: 0,
    },
    metricValueLabel: {
        color: COLORS.onSurface,
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 8,
    },
    metricValueText: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    scrollbarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingHorizontal: 4,
    },
    scrollbarTrack: {
        flex: 1,
        height: 4,
        backgroundColor: COLORS.surfaceContainerHighest,
        borderRadius: 2,
        marginHorizontal: 8,
        position: 'relative',
        overflow: 'hidden',
    },
    scrollbarThumb: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: COLORS.outline,
        borderRadius: 2,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(19, 19, 19, 0.95)',
        borderTopWidth: 1,
        borderTopColor: COLORS.surfaceContainerHighest,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: Platform.OS === 'android' ? 40 : 16,
        zIndex: 50,
    },
    saveButton: {
        backgroundColor: '#b6f09c',
        borderRadius: 8,
        paddingVertical: 16,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
    },
    saveButtonText: {
        color: '#0b3900',
        fontSize: 16,
        fontWeight: '500',
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: 12,
        maxWidth: 384,
        width: '100%',
        padding: 24,
        gap: 24,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 8},
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 16,
    },
    modalTextGroup: {
        gap: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.onSurface,
        lineHeight: 28,
    },
    modalBody: {
        fontSize: 16,
        color: COLORS.onSurfaceVariant,
        lineHeight: 24,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    modalCancelButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 24,
    },
    modalCancelButtonText: {
        color: COLORS.onSurface,
        fontSize: 14,
        fontWeight: '500',
    },
    modalDeleteButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 24,
        backgroundColor: COLORS.error,
    },
    modalDeleteButtonDisabled: {
        opacity: 0.6,
    },
    modalDeleteButtonText: {
        color: COLORS.onError,
        fontSize: 14,
        fontWeight: '500',
    },
});
