package cn.criesa.service;

import cn.criesa.model.dto.Friend;
import cn.criesa.model.vo.FriendInfo;

import java.util.List;

public interface FriendService {
	List<cn.criesa.entity.Friend> getFriendList();

	List<cn.criesa.model.vo.Friend> getFriendVOList();

	void updateFriendPublishedById(Long friendId, Boolean published);

	void saveFriend(cn.criesa.entity.Friend friend);

	void updateFriend(Friend friend);

	void deleteFriend(Long id);

	void updateViewsByNickname(String nickname);

	FriendInfo getFriendInfo(boolean cache, boolean md);

	void updateFriendInfoContent(String content);

	void updateFriendInfoCommentEnabled(Boolean commentEnabled);
}
