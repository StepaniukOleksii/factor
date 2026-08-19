import React, {useCallback, useState} from 'react';
import {
    BackHandler,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar as RNStatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {SQLiteObservationRepository} from '../../infrastructure/SQLiteObservationRepository';
import {SQLiteRecordRepository} from '../../infrastructure/SQLiteRecordRepository';
import {CountRecordsUseCase} from '../../application/CountRecordsUseCase';
import {GetObservationByIdUseCase} from '../../application/GetObservationByIdUseCase';
import {GetRecentRecordsUseCase} from '../../application/GetRecentRecordsUseCase';
import {GetRecordsByTimeRangeUseCase} from '../../application/GetRecordsByTimeRangeUseCase';
import {DeleteObservationUseCase} from '../../application/DeleteObservationUseCase';
import {DeleteRecordUseCase} from '../../application/DeleteRecordUseCase';
import {
    AggregationStrategy,
    GetMetricSeriesUseCase,
    MetricSeriesPoint,
    TimeRange,
} from '../../application/GetMetricSeriesUseCase';
import {Observation} from '../../domain/Observation';
import {Record as DomainRecord} from '../../domain/Record';
import {
    CenteredState,
    Dialog,
    FooterBar,
    PrimaryActionButton,
    ScreenContainer,
    ScreenHeader,
    useFooterClearance
} from "@presentation/components";
import {COLORS, ELEVATION, RADIUS, TYPOGRAPHY} from "@presentation/theme";
import {formatMetricValue} from "@presentation/metricDisplay";
import {formatRecordCount} from '@shared/formatRecordCount';
import {formatRelativeTime} from '@shared/formatRelativeTime';
import {rendererRegistry} from '../charts/rendererRegistry';
import {
    DEFAULT_TIME_RANGE_SELECTION,
    getAggregationForSelection,
    getDayAlignedRange,
    getTimeRangeForSelection,
    type TimeRangeSelection,
    TREND_INSUFFICIENT_MESSAGE,
} from '../charts/chartDefaults';
import {TimeRangeSelector} from '../charts/TimeRangeSelector';
import {CustomTimeRangeModal} from '../charts/CustomTimeRangeModal';
import type {RootStackParamList} from '../navigation/routes';

const observationRepository = new SQLiteObservationRepository();
const recordRepository = new SQLiteRecordRepository();
const getObservationByIdUseCase = new GetObservationByIdUseCase(observationRepository);
const getRecentRecordsUseCase = new GetRecentRecordsUseCase(recordRepository);
const countRecordsUseCase = new CountRecordsUseCase(recordRepository);
const getRecordsByTimeRangeUseCase = new GetRecordsByTimeRangeUseCase(recordRepository);
const getMetricSeriesUseCase = new GetMetricSeriesUseCase();
const deleteObservationUseCase = new DeleteObservationUseCase(observationRepository, recordRepository);
const deleteRecordUseCase = new DeleteRecordUseCase(recordRepository);


// The overflow menu lives in a full-screen Modal window, so it anchors from the
// very top of the screen: below the Android status bar (which ScreenContainer
// pads for) plus the ScreenHeader's own 64px height, landing it just under the
// header.
const MENU_TOP = (Platform.OS === 'android' ? RNStatusBar.currentHeight ?? 0 : 0) + 64;

/** How long a window is, for comparing one against another. */
function spanOf(range: TimeRange): number {
    return range.end.getTime() - range.start.getTime();
}

/**
 * The window the charts are drawn over. Both halves are set together, when the
 * Records for them land: a tapped preset lands on the selection while its
 * Records are still in flight, so a bucket size taken from the selection instead
 * would spend that render bucketing the window on screen by the size the next
 * one asked for - one bucket wide whenever that size is the old window's span.
 */
interface ChartWindow {
    range: TimeRange;
    aggregation: AggregationStrategy;
}

export type ObservationDetailsScreenProps = NativeStackScreenProps<RootStackParamList, 'ObservationDetails'>;

export function ObservationDetailsScreen({route, navigation}: ObservationDetailsScreenProps) {
    const {observationId} = route.params;

    const onBack = () => navigation.goBack();
    const onCreateRecord = () => navigation.navigate('CreateRecord', {observationId});
    const onEditRecord = (recordId: string) => navigation.navigate('EditRecord', {observationId, recordId});
    const onEditObservation = () => navigation.navigate('EditObservation', {observationId});
    // The Observation this journey was about no longer exists, so the whole
    // journey goes with it rather than leaving a screen for it behind.
    const onDeleted = () => navigation.popToTop();

    // The Trends windows this visit has been through, the last one active. One
    // array rather than a current-plus-previous pair, so there is exactly one
    // place the active window can come from.
    //
    // Ordinary local state: it survives a Record screen sitting on top and dies
    // when this screen is popped, which is the visit scoping from ADR-2.
    const [timeRangeHistory, setTimeRangeHistory] =
        useState<TimeRangeSelection[]>([DEFAULT_TIME_RANGE_SELECTION]);
    const timeRangeSelection = timeRangeHistory[timeRangeHistory.length - 1];
    const [observation, setObservation] = useState<Observation | null>(null);
    const [records, setRecords] = useState<DomainRecord[]>([]);
    const [recordCount, setRecordCount] = useState(0);
    const [chartRecords, setChartRecords] = useState<DomainRecord[]>([]);
    const [chartWindow, setChartWindow] = useState<ChartWindow | null>(null);
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
    const footerClearance = useFooterClearance();

    // On focus rather than on mount: this screen stays mounted while a Record
    // screen sits on top of it, so a mount effect would fire once and never
    // again, and a Record added or edited up there would never appear here.
    // Deliberately not keyed on the selected window - choosing one re-scopes
    // the charts only, below.
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [observationId]),
    );

    // Owns the trend fetch alone, so switching window re-scopes the charts
    // without re-fetching the Observation or its Recent Records. Keyed on the
    // selection as well as focus, which covers all three moments it has to
    // cover: the first load, a switch while the screen is up, and the return
    // from a Record - the last re-querying whatever window is showing, since a
    // refresh reloads data without disturbing the user's choice of window.
    useFocusEffect(
        useCallback(() => {
            loadTrendData(timeRangeSelection);
        }, [observationId, timeRangeSelection]),
    );

    // On focus rather than on mount: `BackHandler` listeners are global and fire
    // whichever screen is on top, so a mount-scoped one would go on unzooming
    // these charts while the user was backing out of a Record. And `BackHandler`
    // rather than React Navigation's `beforeRemove`, which sees every route
    // removal - the header arrow included, and that has to keep leaving. Open
    // dialogs need nothing here: an Android `Modal` takes the press in its own
    // window, so this listener is never reached.
    useFocusEffect(
        useCallback(() => {
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                // Popping mid-fetch would stack a second reload on the one in
                // flight - the guard chart taps already carry.
                if (loadingTrends) {
                    return true;
                }
                if (timeRangeHistory.length === 1) {
                    return false;
                }
                setTimeRangeHistory(history => history.slice(0, -1));
                return true;
            });
            return () => subscription.remove();
        }, [loadingTrends, timeRangeHistory]),
    );

    const loadRecentRecords = async () => {
        const recentRecords = await getRecentRecordsUseCase.execute(observationId, 3);
        setRecords(recentRecords);
    };

    const loadRecordCount = async () => {
        setRecordCount(await countRecordsUseCase.execute(observationId));
    };

    const loadTrendData = async (selection: TimeRangeSelection) => {
        try {
            setLoadingTrends(true);
            const range = getTimeRangeForSelection(selection);
            const rangeRecords = await getRecordsByTimeRangeUseCase.execute(observationId, range);
            setChartWindow({range, aggregation: getAggregationForSelection(selection)});
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
                await loadRecordCount();
            }
        } catch (error) {
            console.error('Failed to load observation details', error);
        } finally {
            setLoading(false);
        }
    };

    // What a tap on a chart point means. A point standing for a single Record
    // opens it; one that folds several together narrows the section onto the
    // days those Records fall on, so they become points of their own. Not onto
    // the bucket that held them: a bucket is a grid laid over the window, and
    // zooming to one leaves the curve stranded in whatever part of it the
    // Records don't reach.
    const handleChartPointPress = (point: MetricSeriesPoint) => {
        // The guard the selector's own segments already carry, applied to the
        // other way into a window switch: a tap landing mid-fetch would stack a
        // second, overlapping reload on the one in flight.
        if (loadingTrends) {
            return;
        }
        if (point.recordCount === 1) {
            onEditRecord(point.recordId);
            return;
        }
        const zoomed = getDayAlignedRange(
            new Date(point.firstRecordAt),
            new Date(point.lastRecordAt),
        );
        // Only worth following if it actually closes in on the Records. Once the
        // window is a single day this stops being true - a day is as narrow as
        // day alignment goes - so zoom settles there instead of needing its own
        // floor to say when to stop.
        if (!chartWindow || spanOf(zoomed) >= spanOf(chartWindow.range)) {
            return;
        }
        // Only this branch touches the history: a tap that opens a Record, or one
        // already at rest at a single day, leaves nothing for back to undo.
        setTimeRangeHistory(history => [...history, {kind: 'custom', range: zoomed}]);
    };

    const toggleExpand = (recordId: string) => {
        setExpandedRecordId(prev => prev === recordId ? null : recordId);
    };

    const handleMenuPress = () => {
        setMenuVisible(prev => !prev);
    };

    const handleEditMenuItemPress = () => {
        setMenuVisible(false);
        onEditObservation();
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
            // Deleting is the only change made without leaving the screen, so
            // the focus effect that re-queries the charts never runs for it.
            await loadRecentRecords();
            await loadRecordCount();
            await loadTrendData(timeRangeSelection);
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

    const created = `Created ${observation.createdAt.toLocaleDateString()}`;
    const counted = formatRecordCount(recordCount);
    const metadata = `${created} · ${counted}`;
    // A comma rather than the middle dot, which is not something a screen reader
    // can make sense of between two halves of one phrase.
    const metadataLabel = `${created}, ${counted}`;

    return (
        <ScreenContainer>
            <ScreenHeader
                title={observation.name}
                onBack={onBack}
                rightAction={
                    <TouchableOpacity
                        onPress={handleMenuPress}
                        style={styles.menuButton}
                        accessibilityLabel="More options"
                    >
                        <MaterialIcons name="more-vert" size={24} color={COLORS.onSurface}/>
                    </TouchableOpacity>
                }/>

            {/* Overflow menu in its own Modal window rather than an inline
                absolutely-positioned dropdown. The inline version layered on top
                via zIndex but sat outside its header parent's bounds, so Android
                left it out of the accessibility tree entirely - unreachable by
                TalkBack and by UI tests alike. A Modal renders in its own window,
                which is captured normally. */}
            <Modal
                visible={menuVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                navigationBarTranslucent
                onRequestClose={() => setMenuVisible(false)}
            >
                <Pressable style={styles.menuModalOverlay} onPress={() => setMenuVisible(false)}>
                    <Pressable
                        style={[styles.menuDropdown, {top: MENU_TOP, right: 8}]}
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Non-destructive first, the order the Record actions
                            dialog puts the same pair in. */}
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={handleEditMenuItemPress}
                            accessibilityLabel="Edit observation"
                        >
                            <MaterialIcons name="edit" size={20} color={COLORS.onSurface}/>
                            <Text style={styles.menuItemText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={handleDeleteMenuItemPress}
                            accessibilityLabel="Delete observation"
                        >
                            <MaterialIcons name="delete" size={20} color={COLORS.error}/>
                            <Text style={styles.menuItemTextDestructive}>Delete</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>


            <ScrollView contentContainerStyle={[styles.scrollContent, {paddingBottom: footerClearance}]}>

                {observation.description ? (
                    <Text style={styles.description}>{observation.description}</Text>
                ) : null}

                <Text style={styles.metadata} accessibilityLabel={metadataLabel}>{metadata}</Text>

                {(() => {
                    // In the Observation's own order, so cards interleave by
                    // declaration rather than grouping by type.
                    const chartedMetrics = observation.metrics.filter(metric => rendererRegistry.has(metric.type));
                    if (chartedMetrics.length === 0) {
                        return null;
                    }
                    return (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>TRENDS</Text>
                            <View style={styles.trendsSelector}>
                                {/* A window picked outright - here or in the range
                                    modal below - starts a fresh history: the user
                                    is stating where to be, not descending. */}
                                <TimeRangeSelector
                                    selected={timeRangeSelection}
                                    onSelectPreset={preset => setTimeRangeHistory([{kind: 'preset', preset}])}
                                    onPressCustom={() => setCustomModalVisible(true)}
                                    disabled={loadingTrends}
                                />
                            </View>
                            <CustomTimeRangeModal
                                visible={customModalVisible}
                                initialRange={getTimeRangeForSelection(timeRangeSelection)}
                                onCancel={() => setCustomModalVisible(false)}
                                onApply={range => {
                                    setTimeRangeHistory([{kind: 'custom', range}]);
                                    setCustomModalVisible(false);
                                }}
                            />
                            <View style={styles.trendsList}>
                                {chartedMetrics.map(metric => {
                                    // Filtered on `has` just above, so every one of these has a registration.
                                    const {renderer: Renderer, cardHeight} = rendererRegistry.get(metric.type)!;
                                    const points = chartWindow
                                        ? getMetricSeriesUseCase.execute(
                                            chartRecords,
                                            metric,
                                            chartWindow.range,
                                            chartWindow.aggregation,
                                        )
                                        : [];
                                    const hasEnoughData = points.length >= 1;
                                    return (
                                        <View key={metric.id} style={styles.trendCard}>
                                            <Text style={styles.trendCardTitle}>{metric.name}</Text>
                                            {hasEnoughData ? (
                                                <View
                                                    testID="trend-chart"
                                                    style={[styles.trendChart, {height: cardHeight}]}
                                                    onLayout={(e) => setTrendChartWidth(e.nativeEvent.layout.width)}
                                                >
                                                    <Renderer
                                                        metric={metric}
                                                        points={points}
                                                        timeRange={chartWindow!.range}
                                                        aggregation={chartWindow!.aggregation}
                                                        width={trendChartWidth}
                                                        height={cardHeight}
                                                        onPointPress={handleChartPointPress}
                                                    />
                                                </View>
                                            ) : (
                                                // Its own chart's height, so a card keeps its size as its
                                                // window empties and fills.
                                                <View style={[styles.trendEmpty, {height: cardHeight}]}
                                                      testID="trend-empty">
                                                    <MaterialIcons name="show-chart" size={22}
                                                                   color={COLORS.onSurfaceVariant}/>
                                                    <Text style={styles.trendEmptyText}>
                                                        {TREND_INSUFFICIENT_MESSAGE}
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
                                                {record.note ? (
                                                    <MaterialIcons
                                                        name="sticky-note-2"
                                                        size={16}
                                                        color={COLORS.onSurfaceVariant}
                                                        style={styles.noteIcon}
                                                        accessibilityLabel="Has a note"
                                                    />
                                                ) : null}
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
                                                        const displayVal = formatMetricValue(metric.type, val);
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

                                                {/* Deliberately uncaptioned: on an Observation
                                                    whose Metric is named "note", a "NOTE"
                                                    caption here would put that word on screen
                                                    twice. */}
                                                {record.note ? (
                                                    <View style={styles.recordNote}>
                                                        <MaterialIcons name="sticky-note-2" size={16}
                                                                       color={COLORS.onSurfaceVariant}
                                                                       style={styles.recordNoteIcon}/>
                                                        <Text style={styles.recordNoteText}>{record.note}</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>

            </ScrollView>

            <FooterBar>
                <PrimaryActionButton label="Add Record" onPress={onCreateRecord}/>
            </FooterBar>

            {/* Cancel deliberately carries no accessibility label:
                `.maestro/2-2-record-actions-presentation.yaml` taps it by its
                visible text. */}
            <Dialog
                visible={selectedRecordForMenu !== null}
                title="Record actions"
                message={selectedRecordForMenu ? formatRelativeTime(selectedRecordForMenu.timestamp) : undefined}
                onRequestClose={handleCloseRecordMenu}
                actions={[{label: 'Cancel', onPress: handleCloseRecordMenu}]}
            >
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
            </Dialog>

            <Dialog
                visible={recordDeleteModalVisible}
                title="Delete this record?"
                message="This specific entry will be permanently removed."
                onRequestClose={handleCancelDeleteRecord}
                actions={[
                    {
                        label: 'Cancel',
                        onPress: handleCancelDeleteRecord,
                        disabled: deletingRecord,
                        accessibilityLabel: 'Cancel record deletion',
                    },
                    {
                        label: deletingRecord ? 'Deleting…' : 'Delete',
                        onPress: handleConfirmDeleteRecord,
                        variant: 'destructive',
                        disabled: deletingRecord,
                        accessibilityLabel: 'Confirm record deletion',
                    },
                ]}
            />

            <Dialog
                visible={deleteModalVisible}
                title="Delete Observation?"
                message={'Are you sure you want to delete this observation and all its records? ' +
                    'This action cannot be undone.'}
                onRequestClose={handleCancelDelete}
                actions={[
                    {
                        label: 'Cancel',
                        onPress: handleCancelDelete,
                        disabled: deleting,
                        accessibilityLabel: 'Cancel deletion',
                    },
                    {
                        label: deleting ? 'Deleting…' : 'Delete',
                        onPress: handleConfirmDelete,
                        variant: 'destructive',
                        disabled: deleting,
                        accessibilityLabel: 'Confirm deletion',
                    },
                ]}
            />
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    menuButton: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    menuModalOverlay: {
        flex: 1,
    },
    menuDropdown: {
        position: 'absolute',
        width: 192,
        backgroundColor: COLORS.surfaceContainerHigh,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.lg,
        ...ELEVATION.dropdown,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuItemText: {
        color: COLORS.onSurface,
        fontSize: 14,
        fontWeight: '500',
    },
    menuItemTextDestructive: {
        color: COLORS.error,
        fontSize: 14,
        fontWeight: '500',
    },
    scrollContent: {
        padding: 24,
    },
    description: {
        color: COLORS.onSurfaceVariant,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 8,
    },
    // The list card's own metadata line, so the same class of information reads
    // the same on both screens.
    metadata: {
        color: COLORS.onSurfaceVariant,
        fontSize: 12,
        opacity: 0.7,
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
    },
    trendEmpty: {
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
    noteIcon: {
        marginLeft: 8,
    },
    recordNote: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
    },
    recordNoteIcon: {
        marginTop: 2,
    },
    recordNoteText: {
        flex: 1,
        color: COLORS.onSurfaceVariant,
        fontSize: 14,
        lineHeight: 20,
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
});
