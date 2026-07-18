import React, {useEffect, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {SQLiteRecordRepository} from '../../infrastructure/SQLiteRecordRepository';
import {GetObservationByIdUseCase} from '../../application/GetObservationByIdUseCase';
import {GetRecentRecordsUseCase} from '../../application/GetRecentRecordsUseCase';
import {GetRecordsByTimeRangeUseCase} from '../../application/GetRecordsByTimeRangeUseCase';
import {DeleteObservationUseCase} from '../../application/DeleteObservationUseCase';
import {DeleteRecordUseCase} from '../../application/DeleteRecordUseCase';
import {GetMetricSeriesUseCase, TimeRange} from '../../application/GetMetricSeriesUseCase';
import {Observation} from '../../domain/Observation';
import {Record as DomainRecord} from '../../domain/Record';
import {CenteredState, FooterBar, PrimaryActionButton, ScreenContainer, ScreenHeader} from "@presentation/components";
import {COLORS, ELEVATION, RADIUS, TYPOGRAPHY} from "@presentation/theme";
import {formatRelativeTime} from '@shared/formatRelativeTime';
import {rendererRegistry} from '../charts/rendererRegistry';
import {
    getAggregationForSelection,
    getTimeRangeForSelection,
    NUMERIC_TREND_INSUFFICIENT_MESSAGE,
    type TimeRangeSelection,
} from '../charts/chartDefaults';
import {TimeRangeSelector} from '../charts/TimeRangeSelector';
import {CustomTimeRangeModal} from '../charts/CustomTimeRangeModal';

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const getObservationByIdUseCase = new GetObservationByIdUseCase(observationRepository);
const getRecentRecordsUseCase = new GetRecentRecordsUseCase(recordRepository);
const getRecordsByTimeRangeUseCase = new GetRecordsByTimeRangeUseCase(recordRepository);
const getMetricSeriesUseCase = new GetMetricSeriesUseCase();
const deleteObservationUseCase = new DeleteObservationUseCase(observationRepository, recordRepository);
const deleteRecordUseCase = new DeleteRecordUseCase(recordRepository);

const TREND_CHART_HEIGHT = 90;

export interface ObservationDetailsScreenProps {
    observationId: string;
    /**
     * The Trends window to render. Owned by the navigator rather than this
     * screen: opening a Record unmounts the screen, and the selection has to
     * outlive that so returning lands back on the window the user chose.
     */
    timeRangeSelection: TimeRangeSelection;
    onTimeRangeSelectionChange: (selection: TimeRangeSelection) => void;
    onBack: () => void;
    onCreateRecord: () => void;
    onEditRecord: (recordId: string) => void;
    onDeleted: () => void;
}

export function ObservationDetailsScreen({
                                             observationId,
                                             timeRangeSelection,
                                             onTimeRangeSelectionChange,
                                             onBack,
                                             onCreateRecord,
                                             onEditRecord,
                                             onDeleted
                                         }: ObservationDetailsScreenProps) {
    const [observation, setObservation] = useState<Observation | null>(null);
    const [records, setRecords] = useState<DomainRecord[]>([]);
    const [chartRecords, setChartRecords] = useState<DomainRecord[]>([]);
    const [chartRange, setChartRange] = useState<TimeRange | null>(null);
    const [customModalVisible, setCustomModalVisible] = useState(false);
    const [trendChartWidth, setTrendChartWidth] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingTrends, setLoadingTrends] = useState(false);
    const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
    const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});
    const [contentWidths, setContentWidths] = useState<Record<string, number>>({});
    const [scrollViewWidths, setScrollViewWidths] = useState<Record<string, number>>({});
    const [menuVisible, setMenuVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [selectedRecordForMenu, setSelectedRecordForMenu] = useState<DomainRecord | null>(null);
    const [recordDeleteModalVisible, setRecordDeleteModalVisible] = useState(false);
    const [recordToDelete, setRecordToDelete] = useState<DomainRecord | null>(null);
    const [deletingRecord, setDeletingRecord] = useState(false);

    useEffect(() => {
        loadData();
    }, [observationId]);

    // Owns the trend fetch alone, so switching window re-scopes the charts without
    // re-fetching the Observation or its Recent Records. Covers the initial load
    // too: it fires with the default selection once the Observation is in place.
    useEffect(() => {
        if (observation) {
            loadTrendData(timeRangeSelection);
        }
    }, [observationId, timeRangeSelection, observation]);

    const loadRecentRecords = async () => {
        const recentRecords = await getRecentRecordsUseCase.execute(observationId, 3);
        setRecords(recentRecords);
    };

    const loadTrendData = async (selection: TimeRangeSelection) => {
        try {
            setLoadingTrends(true);
            const range = getTimeRangeForSelection(selection);
            const rangeRecords = await getRecordsByTimeRangeUseCase.execute(observationId, range);
            setChartRange(range);
            setChartRecords(rangeRecords);
        } catch (error) {
            console.error('Failed to load trend data', error);
        } finally {
            setLoadingTrends(false);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const obs = await getObservationByIdUseCase.execute(observationId);
            setObservation(obs);
            if (obs) {
                await loadRecentRecords();
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

    const handleRecordLongPress = (record: DomainRecord) => {
        setSelectedRecordForMenu(record);
    };

    const handleCloseRecordMenu = () => {
        setSelectedRecordForMenu(null);
    };

    const handleEditRecord = () => {
        if (selectedRecordForMenu) {
            onEditRecord(selectedRecordForMenu.id);
        }
        setSelectedRecordForMenu(null);
    };

    const handleDeleteRecordMenuClick = () => {
        setRecordToDelete(selectedRecordForMenu);
        setSelectedRecordForMenu(null);
        setRecordDeleteModalVisible(true);
    };

    const handleCancelDeleteRecord = () => {
        setRecordDeleteModalVisible(false);
        setRecordToDelete(null);
    };

    const handleConfirmDeleteRecord = async () => {
        if (!recordToDelete) return;

        try {
            setDeletingRecord(true);
            await deleteRecordUseCase.execute(recordToDelete.id);
            setRecordDeleteModalVisible(false);
            setRecordToDelete(null);
            await loadRecentRecords();
        } catch (error) {
            console.error('Failed to delete record', error);
            alert('Failed to delete record. Please try again.');
        } finally {
            setDeletingRecord(false);
        }
    };

    if (loading) {
        return (
            <ScreenContainer>
                <ScreenHeader title="Loading..." onBack={onBack}/>
                <CenteredState/>
            </ScreenContainer>
        );
    }

    if (!observation) {
        return (
            <ScreenContainer>
                <ScreenHeader title="Not found" onBack={onBack}/>
                <CenteredState message="Observation not found."/>
            </ScreenContainer>
        );
    }

    return (
        <ScreenContainer>
            <ScreenHeader
                title={observation.name}
                onBack={onBack}
                rightAction={
                    <View>
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
                }/>


            <ScrollView contentContainerStyle={styles.scrollContent}>

                {observation.description ? (
                    <Text style={styles.description}>{observation.description}</Text>
                ) : null}

                {/* Trends Section */}
                {(() => {
                    const numericMetrics = observation.metrics.filter(metric => metric.type === 'Numeric');
                    if (numericMetrics.length === 0) {
                        return null;
                    }
                    const NumericRenderer = rendererRegistry.get('Numeric');
                    const aggregation = getAggregationForSelection(timeRangeSelection);
                    return (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>TRENDS</Text>
                            <View style={styles.trendsSelector}>
                                <TimeRangeSelector
                                    selected={timeRangeSelection}
                                    onSelectPreset={preset => onTimeRangeSelectionChange({kind: 'preset', preset})}
                                    onPressCustom={() => setCustomModalVisible(true)}
                                    disabled={loadingTrends}
                                />
                            </View>
                            <CustomTimeRangeModal
                                visible={customModalVisible}
                                initialRange={getTimeRangeForSelection(timeRangeSelection)}
                                onCancel={() => setCustomModalVisible(false)}
                                onApply={range => {
                                    onTimeRangeSelectionChange({kind: 'custom', range});
                                    setCustomModalVisible(false);
                                }}
                            />
                            <View style={styles.trendsList}>
                                {numericMetrics.map(metric => {
                                    const points = chartRange
                                        ? getMetricSeriesUseCase.execute(chartRecords, metric, chartRange, aggregation)
                                        : [];
                                    const hasEnoughData = points.length >= 2;
                                    return (
                                        <View key={metric.id} style={styles.trendCard}>
                                            <Text style={styles.trendCardTitle}>{metric.name}</Text>
                                            {hasEnoughData && NumericRenderer ? (
                                                <View
                                                    testID="trend-chart"
                                                    style={styles.trendChart}
                                                    onLayout={(e) => setTrendChartWidth(e.nativeEvent.layout.width)}
                                                >
                                                    <NumericRenderer
                                                        metric={metric}
                                                        points={points}
                                                        timeRange={chartRange!}
                                                        width={trendChartWidth}
                                                        height={TREND_CHART_HEIGHT}
                                                        onPointPress={onEditRecord}
                                                    />
                                                </View>
                                            ) : (
                                                <View style={styles.trendEmpty} testID="trend-empty">
                                                    <MaterialIcons name="show-chart" size={22}
                                                                   color={COLORS.onSurfaceVariant}/>
                                                    <Text style={styles.trendEmptyText}>
                                                        {NUMERIC_TREND_INSUFFICIENT_MESSAGE}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })()}

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
                                            onLongPress={() => handleRecordLongPress(record)}
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
            <FooterBar>
                <PrimaryActionButton label="Add Record" onPress={onCreateRecord}/>
            </FooterBar>

            {/* Record Contextual Menu Modal */}
            <Modal
                visible={selectedRecordForMenu !== null}
                transparent
                animationType="fade"
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={handleCloseRecordMenu}
            >
                <Pressable style={styles.recordMenuOverlay} onPress={handleCloseRecordMenu}>
                    <Pressable style={styles.recordMenuContent} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.recordMenuHeader}>
                            <Text style={styles.recordMenuTitle}>Record actions</Text>
                            {selectedRecordForMenu && (
                                <Text style={styles.recordMenuSubtitle}>
                                    {formatRelativeTime(selectedRecordForMenu.timestamp)}
                                </Text>
                            )}
                        </View>
                        <View style={styles.recordMenuActions}>
                            <TouchableOpacity
                                style={styles.recordMenuAction}
                                onPress={handleEditRecord}
                            >
                                <MaterialIcons name="edit" size={20} color={COLORS.onSurface}/>
                                <Text style={styles.recordMenuActionText}>Edit Record</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.recordMenuAction}
                                onPress={handleDeleteRecordMenuClick}
                            >
                                <MaterialIcons name="delete" size={20} color={COLORS.error}/>
                                <Text style={styles.recordMenuActionTextDestructive}>Delete Record</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.recordMenuFooter}>
                            <TouchableOpacity
                                style={styles.recordMenuCancelButton}
                                onPress={handleCloseRecordMenu}
                            >
                                <Text style={styles.recordMenuCancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* Record Delete Confirmation Modal */}
            <Modal
                visible={recordDeleteModalVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={handleCancelDeleteRecord}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <View style={styles.modalTextGroup}>
                            <Text style={styles.modalTitle}>Delete this record?</Text>
                            <Text style={styles.modalBody}>
                                This specific entry will be permanently removed.
                            </Text>
                        </View>
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={handleCancelDeleteRecord}
                                disabled={deletingRecord}
                                accessibilityLabel="Cancel record deletion"
                            >
                                <Text style={styles.modalCancelButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalDeleteButton, deletingRecord && styles.modalDeleteButtonDisabled]}
                                onPress={handleConfirmDeleteRecord}
                                disabled={deletingRecord}
                                accessibilityLabel="Confirm record deletion"
                            >
                                <Text style={styles.modalDeleteButtonText}>
                                    {deletingRecord ? 'Deleting…' : 'Delete'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
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
        borderRadius: RADIUS.lg,
        ...ELEVATION.dropdown,
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
    scrollContent: {
        padding: 24,
        paddingBottom: 120,
    },
    description: {
        color: COLORS.onSurfaceVariant,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 24,
    },
    section: {
        marginBottom: 40,
    },
    sectionTitle: {...TYPOGRAPHY.sectionCaption, marginBottom: 16},
    trendsSelector: {
        marginBottom: 16,
    },
    trendsList: {
        gap: 12,
    },
    trendCard: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.lg,
        padding: 16,
    },
    trendCardTitle: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    trendChart: {
        width: '100%',
        height: TREND_CHART_HEIGHT,
    },
    trendEmpty: {
        height: TREND_CHART_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        opacity: 0.6,
    },
    trendEmptyText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 12,
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
        borderRadius: RADIUS.lg,
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
        borderRadius: RADIUS.md,
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
        borderRadius: RADIUS.xs,
        marginHorizontal: 8,
        position: 'relative',
        overflow: 'hidden',
    },
    scrollbarThumb: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        backgroundColor: COLORS.outline,
        borderRadius: RADIUS.xs,
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
        borderRadius: RADIUS.xl,
        maxWidth: 384,
        width: '100%',
        padding: 24,
        gap: 24,
        ...ELEVATION.dialog,
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
        borderRadius: RADIUS.pill,
    },
    modalCancelButtonText: {
        color: COLORS.onSurface,
        fontSize: 14,
        fontWeight: '500',
    },
    modalDeleteButton: {
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: RADIUS.pill,
        backgroundColor: COLORS.error,
    },
    modalDeleteButtonDisabled: {
        opacity: 0.6,
    },
    modalDeleteButtonText: {
        fontWeight: '500',
    },
    // Record Contextual Menu Styles (centered dialog per design)
    recordMenuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    recordMenuContent: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.xl,
        maxWidth: 320,
        width: '100%',
        padding: 24,
        gap: 24,
        ...ELEVATION.dialog,
    },
    recordMenuHeader: {
        gap: 4,
    },
    recordMenuTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.onSurface,
        lineHeight: 28,
    },
    recordMenuSubtitle: {
        fontSize: 14,
        color: COLORS.onSurfaceVariant,
        fontWeight: '500',
        lineHeight: 20,
    },
    recordMenuActions: {
        gap: 8,
    },
    recordMenuAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: RADIUS.lg,
        backgroundColor: 'transparent',
    },
    recordMenuActionText: {
        fontSize: 14,
        color: COLORS.onSurface,
        fontWeight: '500',
    },
    recordMenuActionTextDestructive: {
        fontSize: 14,
        color: COLORS.error,
        fontWeight: '500',
    },
    recordMenuFooter: {
        alignItems: 'flex-end',
    },
    recordMenuCancelButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: RADIUS.pill,
    },
    recordMenuCancelText: {
        fontSize: 14,
        color: COLORS.onSurfaceVariant,
        fontWeight: '500',
    },
    modalContentSmall: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.xl,
        maxWidth: 320,
        width: '100%',
        padding: 24,
        gap: 20,
        ...ELEVATION.dialog,
    },
});
