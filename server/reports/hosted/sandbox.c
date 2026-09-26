#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <unistd.h>
#include <string.h>
#include <sched.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <sys/resource.h>
#include <linux/landlock.h>
#include <linux/filter.h>
#include <linux/seccomp.h>
#include <linux/audit.h>
#ifndef LANDLOCK_ACCESS_FS_TRUNCATE
#define LANDLOCK_ACCESS_FS_TRUNCATE (1ULL << 14)
#endif
#if defined(__aarch64__)
#define EXPECTED_ARCH AUDIT_ARCH_AARCH64
#elif defined(__x86_64__)
#define EXPECTED_ARCH AUDIT_ARCH_X86_64
#else
#error unsupported architecture
#endif
#define DENY(nr) BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,(nr),0,1), BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ERRNO|EPERM)
static void fail(const char *message) {perror(message);exit(78);}
static void allow(int rules,const char *path,uint64_t access) {
 int fd=open(path,O_PATH|O_CLOEXEC);if(fd<0){if(errno==ENOENT)return;fail("allow-path");}
 struct landlock_path_beneath_attr item={.allowed_access=access,.parent_fd=fd};
 if(syscall(SYS_landlock_add_rule,rules,LANDLOCK_RULE_PATH_BENEATH,&item,0))fail("landlock-rule");
 close(fd);
}
int main(int argc,char **argv) {
 if(argc!=2 || (strcmp(argv[1],"parse") && strcmp(argv[1],"probe")))return 64;
 const char *worker = !strcmp(argv[1],"parse") ? "/worker/server/reports/parser-worker.ts" : "/worker/probe.mjs";
 int abi=syscall(SYS_landlock_create_ruleset,NULL,0,LANDLOCK_CREATE_RULESET_VERSION);
 if(abi<3){fprintf(stderr,"landlock-unavailable abi=%d errno=%d\n",abi,errno);return 78;}
 fprintf(stderr,"landlock-abi=%d\n",abi);
 struct rlimit core={0,0};if(setrlimit(RLIMIT_CORE,&core))fail("core-limit");
 if(prctl(PR_SET_NO_NEW_PRIVS,1,0,0,0))fail("no-new-privs");
 struct landlock_ruleset_attr attrs={.handled_access_fs=(1ULL<<15)-1};
 int rules=syscall(SYS_landlock_create_ruleset,&attrs,sizeof(attrs),0);if(rules<0)fail("landlock-create");
 uint64_t read=LANDLOCK_ACCESS_FS_READ_FILE|LANDLOCK_ACCESS_FS_READ_DIR;
 allow(rules,"/usr/local/bin/node",LANDLOCK_ACCESS_FS_READ_FILE|LANDLOCK_ACCESS_FS_EXECUTE);
 #if defined(__aarch64__)
 allow(rules,"/lib/ld-linux-aarch64.so.1",LANDLOCK_ACCESS_FS_READ_FILE|LANDLOCK_ACCESS_FS_EXECUTE);
#else
 allow(rules,"/lib64/ld-linux-x86-64.so.2",LANDLOCK_ACCESS_FS_READ_FILE|LANDLOCK_ACCESS_FS_EXECUTE);
#endif
 allow(rules,"/usr/lib",read);allow(rules,"/lib",read);allow(rules,"/lib64",read);
 allow(rules,"/app/node_modules",read);allow(rules,"/worker",read);

 allow(rules,"/etc/ld.so.cache",LANDLOCK_ACCESS_FS_READ_FILE);
 allow(rules,"/etc/ssl/openssl.cnf",LANDLOCK_ACCESS_FS_READ_FILE);
 allow(rules,"/dev/urandom",LANDLOCK_ACCESS_FS_READ_FILE);
 if(syscall(SYS_landlock_restrict_self,rules,0))fail("landlock-enforce");
 close(rules);
 struct sock_filter filter[]={
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,arch)),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,EXPECTED_ARCH,1,0),BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,nr)),
#if defined(__x86_64__)
 BPF_JUMP(BPF_JMP|BPF_JSET|BPF_K,0x40000000,0,1),BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_KILL_PROCESS),
#endif
 DENY(SYS_socket),DENY(SYS_socketpair),DENY(SYS_connect),DENY(SYS_bind),DENY(SYS_listen),DENY(SYS_accept4),
 // Only thread creation is needed by Node. clone3 returns ENOSYS for libc fallback.
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_clone3,0,1),BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ERRNO|ENOSYS),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_clone,0,4),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[0])),
 BPF_JUMP(BPF_JMP|BPF_JSET|BPF_K,CLONE_THREAD,1,0),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ERRNO|EPERM),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,nr)),
#if defined(__x86_64__)
 DENY(SYS_fork),DENY(SYS_vfork),DENY(SYS_accept),
#endif
 DENY(SYS_tkill),DENY(SYS_tgkill),DENY(SYS_pidfd_send_signal),
 DENY(SYS_rt_sigqueueinfo),DENY(SYS_rt_tgsigqueueinfo),
 // prlimit64 may query/change this worker only, never another process.
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,SYS_prlimit64,0,4),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,args[0])),
 BPF_JUMP(BPF_JMP|BPF_JEQ|BPF_K,0,1,0),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ERRNO|EPERM),
 BPF_STMT(BPF_LD|BPF_W|BPF_ABS,offsetof(struct seccomp_data,nr)),
 DENY(SYS_ptrace),DENY(SYS_process_vm_readv),DENY(SYS_process_vm_writev),
 DENY(SYS_pidfd_getfd),DENY(SYS_kill),DENY(SYS_mount),DENY(SYS_umount2),
 DENY(SYS_unshare),DENY(SYS_setns),DENY(SYS_io_uring_setup),
 BPF_STMT(BPF_RET|BPF_K,SECCOMP_RET_ALLOW)};
 struct sock_fprog program={.len=sizeof(filter)/sizeof(filter[0]),.filter=filter};
 if(prctl(PR_SET_SECCOMP,SECCOMP_MODE_FILTER,&program))fail("seccomp");
 if(syscall(SYS_close_range,3U,~0U,0))fail("close-extra-fds");
 // RLIMIT_NPROC counts host UID threads across containers; use the observed service cgroup.
 char *env[]={"PATH=/usr/local/bin:/usr/bin:/bin","NODE_ENV=production","LANG=C.UTF-8",NULL};
 char *args[]={"/usr/local/bin/node","--max-old-space-size=128",(char *)worker,NULL};
 if(!strcmp(argv[1],"probe")){printf("%d\n",abi);fflush(stdout);}
 execve(args[0],args,env);fail("exec-node");
}
