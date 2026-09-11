import React, {useCallback, useState} from 'react';
import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {MaterialIcons} from '@expo/vector-icons';
import {useFocusEffect} from '@react-navigation/native';
import {GetEventsUseCase} from '../../application/GetEventsUseCase';
import {SQLiteEventRepository} from '../../infrastructure/SQLiteEventRepository';
import {Event} from '../../domain/Event';
import {CenteredState, ScreenContainer, ScreenHeader} from "@presentation/components";
import {COLORS, RADIUS} from "@presentation/theme";
import {formatRelativeTime} from '@shared/formatRelativeTime';

const repository = new SQLiteEventRepository();
const useCase = new GetEventsUseCase(repository);

const GUTTER = 16;

const PAGE_SIZE = 20;

export function EventListScreen() {
    const [events, setEvents] = useState<Event[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [limit, setLimit] = useState(PAGE_SIZE);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

    // On focus rather than on mount: this screen stays mounted while another
    // sits on top of it, so a mount effect would never fire again (ADR-2).
    // Keyed on the limit as well, which is what re-reads when Load more widens
    // the window.
    useFocusEffect(
        useCallback(() => {
            loadEvents(limit);
        }, [limit]),
    );

    const loadEvents = async (eventLimit: number) => {
        try {
            const page = await useCase.execute(eventLimit);
            setEvents(page.events);
            setHasMore(page.hasMore);
        } catch (error) {
            console.error('Failed to load events', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const loadMore = () => {
        setLoadingMore(true);
        setLimit(current => current + PAGE_SIZE);
    };

    const renderItem = ({item}: { item: Event }) => {
        const expandable = item.description !== null;
        const isExpanded = expandable && expandedEventId === item.id;

        return (
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.tile}
                    onPress={() => setExpandedEventId(isExpanded ? null : item.id)}
                    disabled={!expandable}
                    activeOpacity={0.7}
                >
                    <View style={styles.tileText}>
                        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.moment}>{formatRelativeTime(item.occurredAt)}</Text>
                    </View>
                    {expandable && (
                        <MaterialIcons
                            name={isExpanded ? 'expand-less' : 'expand-more'}
                            size={24}
                            color={COLORS.onSurfaceVariant}
                        />
                    )}
                </TouchableOpacity>

                {isExpanded && <Text style={styles.description}>{item.description}</Text>}
            </View>
        );
    };

    const renderFooter = () => {
        if (!hasMore) return null;

        return (
            <TouchableOpacity
                style={[styles.loadMore, loadingMore && styles.loadMoreDisabled]}
                onPress={loadMore}
                disabled={loadingMore}
                activeOpacity={0.8}
            >
                <Text style={styles.loadMoreLabel}>Load more</Text>
            </TouchableOpacity>
        );
    };

    const renderEmptyComponent = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No events yet.</Text>
            </View>
        );
    };

    return (
        <ScreenContainer>
            <ScreenHeader title="Events"/>

            {loading ? (
                <CenteredState/>
            ) : (
                <FlatList
                    data={events}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    ListEmptyComponent={renderEmptyComponent}
                    ListFooterComponent={renderFooter}
                    contentContainerStyle={styles.listContent}
                />
            )}
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    listContent: {
        padding: GUTTER,
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
    },
    card: {
        backgroundColor: COLORS.surfaceContainerLow,
        borderWidth: 1,
        borderColor: COLORS.outlineVariant,
        borderRadius: RADIUS.lg,
        padding: GUTTER,
        marginBottom: 12,
    },
    tile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: GUTTER,
    },
    tileText: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.primary,
    },
    moment: {
        color: COLORS.onSurfaceVariant,
        fontSize: 12,
        opacity: 0.7,
        marginTop: 4,
    },
    description: {
        color: COLORS.onSurfaceVariant,
        fontSize: 14,
        lineHeight: 20,
        marginTop: 12,
    },
    loadMore: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: GUTTER,
        borderWidth: 1,
        borderColor: COLORS.primaryContainer,
        borderRadius: RADIUS.md,
    },
    loadMoreDisabled: {
        opacity: 0.7,
    },
    loadMoreLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: COLORS.primaryContainer,
    },
});
