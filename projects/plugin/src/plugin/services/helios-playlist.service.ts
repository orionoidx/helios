import { Injectable } from '@angular/core';
import { EventCategory, EventName, EventService, OpenMedia, Playlist, PlaylistService } from '@wako-app/mobile-sdk';
import { KodiOpenMedia } from '../entities/kodi-open-media';
import { StreamLinkSource } from '../entities/stream-link-source';
import { TorrentSource } from '../entities/torrent-source';
import { Storage } from '@ionic/storage';

@Injectable()
export class HeliosPlaylistService {
  private playListService: PlaylistService;

  constructor(private storage: Storage) {
    PlaylistService.initialize(this.storage);

    this.playListService = PlaylistService.getInstance();
  }

  async getAll() {
    return await this.playListService.getAllPlaylistsSortedByDateDesc();
  }

  async getPlaylistFromVideoUrl(videoUrl: string) {
    const playlists = await this.getAll();
    for (const playlist of playlists) {
      for (const item of playlist.items) {
        if (item.url === videoUrl) {
          return playlist;
        }
      }
    }
    return null;
  }

  getPlaylist(sourceId: string, label: string, kodiOpenMedia?: KodiOpenMedia) {
    let id = sourceId;
    let poster = null;

    if (kodiOpenMedia) {
      if (kodiOpenMedia.movie) {
        id = (kodiOpenMedia.movie.ids.trakt ?? kodiOpenMedia.movie.ids.imdb).toString();
        label = kodiOpenMedia.movie.title;
        if (kodiOpenMedia.movie.imagesUrl) {
          poster = kodiOpenMedia.movie.imagesUrl.poster;
        }
      } else if (kodiOpenMedia.show) {
        id = (kodiOpenMedia.show.ids.trakt ?? kodiOpenMedia.show.ids.simkl).toString();
        label = kodiOpenMedia.show.title + ' S' + kodiOpenMedia.episode.seasonNumber.toString().padStart(2, '0');
        if (kodiOpenMedia.show.imagesUrl) {
          poster = kodiOpenMedia.show.imagesUrl.poster;
        }
      }
    }

    return {
      id,
      label,
      currentItem: 0,
      poster,
      updatedAt: new Date().toISOString(),
      items: []
    } as Playlist;
  }

  async setPlaylist(source: StreamLinkSource | TorrentSource, kodiOpenMedia: KodiOpenMedia) {
    const playlist = await this.getPlaylist(source.id, source.title, kodiOpenMedia);

    let savedPlaylist = await this.playListService.get(playlist.id);

    if (!savedPlaylist) {
      console.log('CREATE playlist ', { playlist });
      await this.playListService.addOrUpdate(playlist);
      savedPlaylist = await this.playListService.get(playlist.id);
    }

    return savedPlaylist;
  }

  async savePlaylist(playlist: Playlist) {
    this.removeDuplicateEntries(playlist);

    const res = await this.playListService.addOrUpdate(playlist);

    EventService.emit(EventCategory.playlist, EventName.change);

    return res;
  }

  private getId(url: string, openMedia: OpenMedia) {
    if (!openMedia) {
      return url;
    }

    if (openMedia.movieIds) {
      return JSON.stringify(openMedia.movieIds);
    } else if (openMedia.showIds) {
      return JSON.stringify(openMedia.showIds) + '-' + openMedia.seasonNumber + '-' + openMedia.episodeNumber;
    }
    return null;
  }

  private removeDuplicateEntries(playlist: Playlist) {
    const items = [];
    const ids = [];
    playlist.items.forEach((item) => {
      const id = this.getId(item.url, item.openMedia);
      if (ids.includes(id)) {
        return;
      }
      ids.push(id);
      items.push(item);
    });

    playlist.items = items;
  }

  delete(playlist: Playlist) {
    this.playListService.delete(playlist.id);
  }
}
